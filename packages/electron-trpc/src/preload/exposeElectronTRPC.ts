import { ipcRenderer, contextBridge } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { ETRPCResponse, RendererGlobalElectronTRPC } from '../types';

export const exposeElectronTRPC = (): void => {
  const electronTRPC: RendererGlobalElectronTRPC = {
    sendMessage: (request) => ipcRenderer.send(ELECTRON_TRPC_CHANNEL, request),
    onMessage: (callback) => {
      const listener = (_event: IpcRendererEvent, response: ETRPCResponse) => callback(response);
      ipcRenderer.on(ELECTRON_TRPC_CHANNEL, listener);
      return () => {
        ipcRenderer.removeListener(ELECTRON_TRPC_CHANNEL, listener);
      };
    },
  };
  contextBridge.exposeInMainWorld('electronTRPC', electronTRPC);
};
