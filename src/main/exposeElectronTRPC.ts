import type { IpcRenderer, ContextBridge } from 'electron';
import { TRPCHandlerArgs } from './types';

export const exposeElectronTRPC = ({
  contextBridge,
  ipcRenderer,
}: {
  contextBridge: ContextBridge;
  ipcRenderer: IpcRenderer;
}) => {
  return contextBridge.exposeInMainWorld('electronTRPC', {
    rpc: (args: TRPCHandlerArgs) => ipcRenderer.invoke('electron-trpc', args),
  });
};
