import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { handleIPCMessage } from './handleIPCMessage';
import { CreateContextOptions } from './types';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import { ETRPCRequest } from '../types';
import { Unsubscribable } from '@trpc/server/observable';

type Awaitable<T> = T | Promise<T>;

const getInternalId = (event: IpcMainInvokeEvent, request: ETRPCRequest) => {
  const messageId = request.method === 'request' ? request.operation.id : request.id;
  return `${event.sender.id}-${event.senderFrame.routingId}:${messageId}`;
};

class IPCHandler<TRouter extends AnyRouter> {
  #windows: BrowserWindow[] = [];
  #subscriptions: Map<string, Unsubscribable> = new Map();

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

    ipcMain.on(ELECTRON_TRPC_CHANNEL, (event: IpcMainInvokeEvent, request: ETRPCRequest) => {
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

    this.#windows.push(win);
    this.#attachSubscriptionCleanupHandler(win);
  }

  detachWindow(win: BrowserWindow) {
    this.#windows = this.#windows.filter((w) => w !== win);

    for (const [key, sub] of this.#subscriptions.entries()) {
      if (key.startsWith(`${win.webContents.id}-`)) {
        sub.unsubscribe();
        this.#subscriptions.delete(key);
      }
    }
  }

  #attachSubscriptionCleanupHandler(win: BrowserWindow) {
    win.webContents.on('destroyed', () => {
      this.detachWindow(win);
    });
  }
}

export const createIPCHandler = <TRouter extends AnyRouter>({
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
