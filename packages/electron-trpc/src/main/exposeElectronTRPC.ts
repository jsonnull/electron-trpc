import * as electron from 'electron';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { RendererGlobalElectronTRPC } from '../types';

export const exposeElectronTRPC = () => {
  const electronTRPC: RendererGlobalElectronTRPC = {
    sendMessage: (operation) => electron.ipcRenderer.send(ELECTRON_TRPC_CHANNEL, operation),
    onMessage: (callback) =>
      electron.ipcRenderer.on(ELECTRON_TRPC_CHANNEL, (_event, args) => callback(args)),
  };
  electron.contextBridge.exposeInMainWorld('electronTRPC', electronTRPC);
};
