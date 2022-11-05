import path from 'path';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api';

app.on('ready', () => {
  createIPCHandler({ router });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.resolve(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.resolve(__dirname, '../../renderer/dist/index.html'));

  win.show();
});
