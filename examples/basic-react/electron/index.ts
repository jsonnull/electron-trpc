import path from 'path';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api';

const url = process.env['VITE_DEV_SERVER_URL'];

app.on('ready', () => {
  // Registers the electron-trpc preload script, so it has to happen before any page loads.
  createIPCHandler({ router });

  const win = new BrowserWindow();

  if (url) {
    win.loadURL(url);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.show();
});
