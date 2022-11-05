import type { Operation } from '@trpc/client';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { resolveIPCResponse } from './resolveIPCResponse';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

export function createIPCHandler<TRouter extends AnyRouter>({
  createContext,
  router,
}: {
  createContext?: () => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
}) {
  ipcMain.handle(ELECTRON_TRPC_CHANNEL, (_event: IpcMainInvokeEvent, args: Operation) => {
    return resolveIPCResponse({ router, createContext, operation: args });
  });
}
