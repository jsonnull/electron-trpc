import type { Operation } from '@trpc/client';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { handleIPCOperation } from './handleIPCOperation';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

class IPCHandler<TRouter extends AnyRouter> {
  #windows: BrowserWindow[];

  constructor({
    createContext,
    router,
    windows = [],
  }: {
    createContext?: () => Promise<inferRouterContext<TRouter>>;
    router: TRouter;
    windows?: BrowserWindow[];
  }) {
    this.#windows = windows;

    ipcMain.on(ELECTRON_TRPC_CHANNEL, (_event: IpcMainInvokeEvent, args: Operation) => {
      handleIPCOperation({
        router,
        createContext,
        operation: args,
        respond: (response) => this.#sendToAllWindows(response),
      });
    });
  }

  #sendToAllWindows(response: TRPCResponseMessage) {
    this.#windows.forEach((win) => {
      win.webContents.send(ELECTRON_TRPC_CHANNEL, response);
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
