// With `preload: false`, the app's own preload script exposes electron-trpc, alongside anything
// else it exposes to the renderer.
import { exposeElectronTRPC } from 'electron-trpc/preload';

exposeElectronTRPC();
