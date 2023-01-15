import type { Operation } from '@trpc/client';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { ipcRenderer, contextBridge } from 'electron';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

export const exposeElectronTRPC = () => {
  contextBridge.exposeInMainWorld('electronTRPC', {
    sendMessage: (args: Operation) => ipcRenderer.send(ELECTRON_TRPC_CHANNEL, args),
    onMessage: (callback: (args: TRPCResponseMessage) => void) => ipcRenderer.on(ELECTRON_TRPC_CHANNEL, (_event, args) => callback(args)),
  });
};
