import type { AnyRouter, inferRouterContext } from '@trpc/server';
import type { IpcMain } from 'electron';
import { resolveIPCResponse } from './resolveIPCResponse';
import { TRPCHandlerArgs } from './types';

export function createIPCHandler<TRouter extends AnyRouter>({
  createContext,
  router,
  ipcMain,
}: {
  createContext?: () => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
  ipcMain: IpcMain;
}) {
  ipcMain.handle('electron-trpc', (_event: unknown, opts: TRPCHandlerArgs) => {
    const { input, path, type } = opts;
    return resolveIPCResponse({
      createContext,
      input,
      path,
      router,
      type,
    });
  });
}
