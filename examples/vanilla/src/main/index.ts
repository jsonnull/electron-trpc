import * as path from 'path';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api';

function createWindow() {
  const window = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  window.loadFile(path.join(__dirname, '../../index.html'));
  window.show();
}

app.on('ready', () => {
  createIPCHandler({ router });

  /**
   * Create two windows to show that the counter is shared between them
   */
  createWindow();
  createWindow();
});
