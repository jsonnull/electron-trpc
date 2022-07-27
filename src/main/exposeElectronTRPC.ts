import type { IpcRenderer } from 'electron';
import { TRPCHandlerArgs } from './types';

export const exposeElectronTRPC = (ipcRenderer: IpcRenderer) => {
  return {
    rpc: (args: TRPCHandlerArgs) => ipcRenderer.invoke('electron-trpc', args),
  };
};
