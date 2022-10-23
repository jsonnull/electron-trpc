import path from 'path';
import { app, ipcMain, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc';
import { router } from './api';

app.on('ready', () => {
  createIPCHandler({ ipcMain, router: router as any });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.resolve(__dirname, '../../renderer/dist/index.html'));

  win.show();
});
