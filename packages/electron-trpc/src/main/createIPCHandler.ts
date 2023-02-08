import type { Operation } from '@trpc/client';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { handleIPCOperation } from './handleIPCOperation';
import { CreateContextOptions } from './types';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

type Awaitable<T> = T | Promise<T>;

class IPCHandler<TRouter extends AnyRouter> {
  #windows: BrowserWindow[];

  constructor({
    createContext,
    router,
    windows = [],
  }: {
    createContext?: (opts: CreateContextOptions) => Awaitable<inferRouterContext<TRouter>>;
    router: TRouter;
    windows?: BrowserWindow[];
  }) {
    this.#windows = windows;

    ipcMain.on(ELECTRON_TRPC_CHANNEL, (event: IpcMainInvokeEvent, args: Operation) => {
      handleIPCOperation({
        router,
        createContext,
        event,
        operation: args,
      });
    });
  }

  attachWindow(win: BrowserWindow) {
    this.#windows.push(win);
  }

  detachWindow(win: BrowserWindow) {
    this.#windows = this.#windows.filter((w) => w !== win);
  }
}

export const createIPCHandler = <TRouter extends AnyRouter>({
  createContext,
  router,
  windows = [],
}: {
  createContext?: () => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
  windows?: Electron.BrowserWindow[];
}) => {
  return new IPCHandler({ createContext, router, windows });
};
