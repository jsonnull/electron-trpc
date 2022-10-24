import * as path from 'path';
import { app, ipcMain, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc';
import { appRouter } from './api';

app.on('ready', () => {
  createIPCHandler({ ipcMain, router: appRouter as any });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadFile(path.join(__dirname, '../index.html'));
  win.show();
  win.webContents.openDevTools();
});

console.log('from main');
