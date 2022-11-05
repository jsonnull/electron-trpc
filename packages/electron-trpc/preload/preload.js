const { exposeElectronTRPC } = require('electron-trpc/main');

process.once('loaded', async () => {
  exposeElectronTRPC();
});
