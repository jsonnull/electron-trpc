import type { Operation } from '@trpc/client';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { resolveIPCResponse } from './resolveIPCResponse';

export function createIPCHandler<TRouter extends AnyRouter>({
  ipcMain,
  createContext,
  router,
}: {
  ipcMain: IpcMain;
  createContext?: () => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
}) {
  ipcMain.handle('electron-trpc', (_event: IpcMainInvokeEvent, args: Operation) => {
    return resolveIPCResponse({ router, createContext, operation: args });
  });
}
