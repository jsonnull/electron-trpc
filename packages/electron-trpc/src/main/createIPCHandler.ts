import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server';
import { Unsubscribable } from '@trpc/server/observable';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainEvent } from 'electron';

import { ELECTRON_TRPC_CHANNEL } from '../constants';
import { ETRPCRequest } from '../types';
import { handleIPCMessage } from './handleIPCMessage';
import { CreateContextOptions } from './types';
import debugFactory from 'debug';

const debug = debugFactory('electron-trpc:main:IPCHandler');

type MaybePromise<TType> = Promise<TType> | TType;

const getInternalId = (event: IpcMainEvent, request: ETRPCRequest) => {
  const messageId = request.method === 'request' ? request.operation.id : request.id;
  return `${event.sender.id}-${event.senderFrame.routingId}:${messageId}`;
};

class IPCHandler<TRouter extends AnyTRPCRouter> {
  #windows: BrowserWindow[] = [];
  #subscriptions: Map<string, Unsubscribable> = new Map();

  constructor({
    createContext,
    router,
    windows = [],
  }: {
    createContext?: (opts: CreateContextOptions) => MaybePromise<inferRouterContext<TRouter>>;
    router: TRouter;
    windows?: BrowserWindow[];
  }) {
    windows.forEach((win) => this.attachWindow(win));

    ipcMain.on(ELECTRON_TRPC_CHANNEL, (event: IpcMainEvent, request: ETRPCRequest) => {
      handleIPCMessage({
        router,
        createContext,
        internalId: getInternalId(event, request),
        event,
        message: request,
        subscriptions: this.#subscriptions,
      });
    });
  }

  attachWindow(win: BrowserWindow) {
    if (this.#windows.includes(win)) {
      return;
    }

    debug('Attaching window', win.id);

    this.#windows.push(win);
    this.#attachSubscriptionCleanupHandlers(win);
  }

  detachWindow(win: BrowserWindow, webContentsId?: number) {
    debug('Detaching window', win.id);

    if (win.isDestroyed() && webContentsId === undefined) {
      throw new Error('webContentsId is required when calling detachWindow on a destroyed window');
    }

    this.#windows = this.#windows.filter((w) => w !== win);
    this.#cleanUpSubscriptions({ webContentsId: webContentsId ?? win.webContents.id });
  }

  #cleanUpSubscriptions({
    webContentsId,
    frameRoutingId,
  }: {
    webContentsId: number;
    frameRoutingId?: number;
  }) {
    for (const [key, sub] of this.#subscriptions.entries()) {
      if (key.startsWith(`${webContentsId}-${frameRoutingId ?? ''}`)) {
        debug('Closing subscription', key);
        sub.unsubscribe();
        this.#subscriptions.delete(key);
      }
    }
  }

  #attachSubscriptionCleanupHandlers(win: BrowserWindow) {
    const webContentsId = win.webContents.id;
    win.webContents.on('did-start-navigation', ({ isSameDocument, frame }) => {
      // Check if it's a hard navigation
      if (!isSameDocument) {
        debug(
          'Handling hard navigation event',
          `webContentsId: ${webContentsId}`,
          `frameRoutingId: ${frame.routingId}`
        );
        this.#cleanUpSubscriptions({
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

export const createIPCHandler = <TRouter extends AnyTRPCRouter>({
  createContext,
  router,
  windows = [],
}: {
  createContext?: (opts: CreateContextOptions) => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
  windows?: Electron.BrowserWindow[];
}) => {
  return new IPCHandler({ createContext, router, windows });
};
