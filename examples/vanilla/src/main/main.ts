import * as path from 'path';
import { app, ipcMain, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { appRouter } from './api';

app.on('ready', () => {
  createIPCHandler({ router: appRouter });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '../../index.html'));
  win.show();
  win.webContents.openDevTools();
});

console.log('from main');
