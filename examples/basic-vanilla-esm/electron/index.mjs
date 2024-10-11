import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const html = path.join(dirname, '../dist/index.html');
const preload = path.join(dirname, '../preload/preload.mjs');

app.on('ready', () => {
  const win = new BrowserWindow({
    webPreferences: {
      /*
       * Disabling sandbox allows preload script to use ESM imports.
       *
       * It is recommended to instead use a bundler to bundle the preload script with its dependencies and leave the
       * sandbox enabled.
       *
       * See https://www.electronjs.org/docs/latest/tutorial/esm
       */
      sandbox: false,
      preload,
    },
  });

  createIPCHandler({ router, windows: [win] });

  win.loadFile(html);

  win.show();
});
