const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { createIPCHandler } = require('electron-trpc/main');
const { router } = require('./api');

app.on('ready', () => {
  // webpack copies electron-trpc's preload script into its output, so this works once packaged.
  createIPCHandler({ router });

  const win = new BrowserWindow();
  win.loadFile(path.join(app.getAppPath(), '.webpack/renderer/index.html'));
  win.show();
});
