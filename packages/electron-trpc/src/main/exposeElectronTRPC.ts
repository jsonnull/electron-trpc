import type { Operation } from '@trpc/client';
import { ipcRenderer, contextBridge } from 'electron';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

export const exposeElectronTRPC = () => {
  contextBridge.exposeInMainWorld('electronTRPC', {
    rpc: (args: Operation) => ipcRenderer.invoke(ELECTRON_TRPC_CHANNEL, args),
  });
};
