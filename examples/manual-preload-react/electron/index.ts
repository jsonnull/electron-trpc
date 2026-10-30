import path from 'path';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api';

const url = process.env['VITE_DEV_SERVER_URL'];

app.on('ready', () => {
  // This app exposes electron-trpc from its own preload script instead.
  createIPCHandler({ router, preload: false });

  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, './preload.js'),
    },
  });

  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.show();
});
