import { contextBridge, ipcRenderer } from 'electron';
import { exposeElectronTRPC } from 'electron-trpc';

process.once('loaded', async () => {
  exposeElectronTRPC({ contextBridge, ipcRenderer });
});
