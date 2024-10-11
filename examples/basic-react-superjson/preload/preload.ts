import { exposeElectronTRPC } from 'electron-trpc/preload';

process.once('loaded', async () => {
  exposeElectronTRPC();
});
