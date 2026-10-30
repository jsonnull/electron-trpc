import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const html = path.join(dirname, '../dist/index.html');

app.on('ready', () => {
  // Registers the electron-trpc preload script, so it has to happen before any page loads.
  createIPCHandler({ router });

  const win = new BrowserWindow();

  win.loadFile(html);

  win.show();
});
