import type { Operation } from '@trpc/client';
import type { IpcRenderer, ContextBridge } from 'electron';

export const exposeElectronTRPC = ({
  contextBridge,
  ipcRenderer,
}: {
  contextBridge: ContextBridge;
  ipcRenderer: IpcRenderer;
}) => {
  return contextBridge.exposeInMainWorld('electronTRPC', {
    rpc: (args: Operation) => ipcRenderer.invoke('electron-trpc', args),
  });
};
