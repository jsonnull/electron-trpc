import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { ipcMain, session } from 'electron';
import type { BrowserWindow, IpcMainEvent, WebFrameMain } from 'electron';
import { handleIPCMessage } from './handleIPCMessage';
import { CreateContextOptions } from './types';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import { ETRPCRequest } from '../types';
import { Unsubscribable } from '@trpc/server/observable';
import debugFactory from 'debug';
import path from 'path';
import { fileURLToPath } from 'url';

const debug = debugFactory('electron-trpc:main:IPCHandler');

type Awaitable<T> = T | Promise<T>;

const getInternalId = (event: IpcMainEvent, frame: WebFrameMain, request: ETRPCRequest) => {
  const messageId = request.method === 'request' ? request.operation.id : request.id;
  return `${event.sender.id}-${frame.routingId}:${messageId}`;
};

class IPCHandler<TRouter extends AnyRouter> {
  private windows: BrowserWindow[] = [];
  private subscriptions: Map<string, Unsubscribable> = new Map();

  constructor({
    createContext,
    router,
    windows = [],
  }: {
    createContext?: (opts: CreateContextOptions) => Awaitable<inferRouterContext<TRouter>>;
    router: TRouter;
    windows?: BrowserWindow[];
  }) {
    windows.forEach((win) => this.attachWindow(win));

    ipcMain.on(ELECTRON_TRPC_CHANNEL, (event: IpcMainEvent, request: ETRPCRequest) => {
      // The sending frame has already navigated or been destroyed, so there is no one to reply to.
      if (!event.senderFrame) return;

      handleIPCMessage({
        router,
        createContext,
        internalId: getInternalId(event, event.senderFrame, request),
        event,
        message: request,
        subscriptions: this.subscriptions,
      });
    });
  }

  attachWindow(win: BrowserWindow) {
    if (this.windows.includes(win)) {
      return;
    }

    debug('Attaching window', win.id);

    this.windows.push(win);
    this.attachSubscriptionCleanupHandlers(win);
  }

  detachWindow(win: BrowserWindow, webContentsId?: number) {
    debug('Detaching window', win.id);

    if (win.isDestroyed() && webContentsId === undefined) {
      throw new Error('webContentsId is required when calling detachWindow on a destroyed window');
    }

    this.windows = this.windows.filter((w) => w !== win);
    this.cleanUpSubscriptions({ webContentsId: webContentsId ?? win.webContents.id });
  }

  private cleanUpSubscriptions({
    webContentsId,
    frameRoutingId,
  }: {
    webContentsId: number;
    frameRoutingId?: number;
  }) {
    for (const [key, sub] of this.subscriptions.entries()) {
      if (key.startsWith(`${webContentsId}-${frameRoutingId ?? ''}`)) {
        debug('Closing subscription', key);
        sub.unsubscribe();
        this.subscriptions.delete(key);
      }
    }
  }

  private attachSubscriptionCleanupHandlers(win: BrowserWindow) {
    const webContentsId = win.webContents.id;
    win.webContents.on('did-start-navigation', ({ isSameDocument, frame }) => {
      // Check if it's a hard navigation
      if (!isSameDocument && frame) {
        debug(
          'Handling hard navigation event',
          `webContentsId: ${webContentsId}`,
          `frameRoutingId: ${frame.routingId}`
        );
        this.cleanUpSubscriptions({
          webContentsId: webContentsId,
          frameRoutingId: frame.routingId,
        });
      }
    });
    win.webContents.on('destroyed', () => {
      debug('Handling webContents `destroyed` event');
      this.detachWindow(win, webContentsId);
    });
  }
}

export const createIPCHandler = <TRouter extends AnyRouter>({
  createContext,
  router,
  windows = [],
  autoRegisterPreload = true,
}: {
  createContext?: (opts: CreateContextOptions) => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
  windows?: Electron.BrowserWindow[];
  autoRegisterPreload?: boolean;
}) => {
  if (autoRegisterPreload) {
    // Register the preload script automatically
    let preloadPath: string;

    // Determine the preload script path
    if (typeof require !== 'undefined' && typeof require.resolve === 'function') {
      // CommonJS - use require.resolve for better compatibility with bundlers
      preloadPath = require.resolve('electron-trpc/preload-auto');
    } else if (typeof import.meta.url !== 'undefined') {
      // ESM - import.meta.url will be in the dist directory
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      preloadPath = path.join(__dirname, 'preload-auto.cjs');
    } else {
      throw new Error(
        'Failed to resolve electron-trpc preload script path. ' +
          'Unable to determine current module directory.'
      );
    }

    debug('Auto-registering preload script at:', preloadPath);

    // Use setPreloads to automatically inject the preload script
    session.defaultSession.setPreloads([...session.defaultSession.getPreloads(), preloadPath]);
  }

  return new IPCHandler({ createContext, router, windows });
};
