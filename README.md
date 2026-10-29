# electron-trpc

<p>
  <a href="https://www.npmjs.com/package/electron-trpc">
    <img alt="NPM" src="https://img.shields.io/npm/v/electron-trpc"/>
  </a>
  <a href="https://codecov.io/gh/jsonnull/electron-trpc"> 
  <img src="https://codecov.io/gh/jsonnull/electron-trpc/branch/main/graph/badge.svg?token=DU33O0D9LZ"/> 
  </a>
  <span>
    <img alt="MIT" src="https://img.shields.io/npm/l/electron-trpc"/>
  </span>
</p>

<p></p>

**Build IPC for Electron with tRPC**

- Expose APIs from Electron's main process to one or more render processes.
- Build fully type-safe IPC.
- Secure alternative to opening servers on localhost.
- Full support for queries, mutations, and subscriptions.

## Installation

```sh
# Using pnpm
pnpm add electron-trpc

# Using yarn
yarn add electron-trpc

# Using npm
npm install --save electron-trpc
```

## Basic Setup

1. Add your tRPC router to the Electron main process using `createIPCHandler`:

   ```ts
   import { app } from 'electron';
   import { createIPCHandler } from 'electron-trpc/main';
   import { router } from './api';

   app.on('ready', () => {
     const win = new BrowserWindow({
       webPreferences: {
         contextIsolation: true, // Required for electron-trpc
       },
     });

     createIPCHandler({ router, windows: [win] });
   });
   ```

   > Note: The preload script is now automatically registered by default. No manual preload configuration needed!

2. If you need to use a custom preload script, you can disable automatic registration:

   ```ts
   createIPCHandler({
     router,
     windows: [win],
     autoRegisterPreload: false, // Disable automatic preload registration
   });
   ```

   Then manually create a preload file:

   ```ts
   import { exposeElectronTRPC } from 'electron-trpc/preload';

   process.once('loaded', async () => {
     exposeElectronTRPC();
   });
   ```

   And specify it in your BrowserWindow:

   ```ts
   const win = new BrowserWindow({
     webPreferences: {
       preload: 'path/to/preload.js',
       contextIsolation: true,
     },
   });
   ```

   > Note: `electron-trpc` depends on `contextIsolation` being enabled, which is the default.

3. When creating the client in the render process, use the `ipcLink` (instead of the HTTP or batch HTTP links):

   ```ts
   import { createTRPCProxyClient } from '@trpc/client';
   import { ipcLink } from 'electron-trpc/renderer';

   export const client = createTRPCProxyClient({
     links: [ipcLink()],
   });
   ```

4. Now you can use the client in your render process as you normally would (e.g. using `@trpc/react`).
