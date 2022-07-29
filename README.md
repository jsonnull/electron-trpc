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
- _Subscription support coming soon_.

## Installation

```sh
# Using yarn
yarn add electron-trpc

# Using npm
npm install --save electron-trpc
```

## Setup

1. Add your tRPC router to the Electron main process using `createIPCHandler`:

   ```ts
   import { app, ipcMain } from 'electron';
   import { createIPCHandler } from 'electron-trpc';
   import { router, createContext } from './api';

   app.on('ready', () => {
     createIPCHandler({ ipcMain, router, createContext }));

     // ...
   });
   ```

2. Expose the IPC to the render process from the [preload file](https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts):

   ```ts
   import { contextBridge, ipcRenderer } from 'electron';
   import { exposeElectronTRPC } from 'electron-trpc';

   process.once('loaded', async () => {
     exposeElectronTRPC({ contextBridge, ipcRenderer });
   });
   ```

   > Note: `electron-trpc` depends on `contextIsolation` being enabled, which is the default.

3. When creating the client in the render process, use the `ipcLink` (instead of the HTTP or batch HTTP links):

   ```ts
   import * as trpc from '@trpc/client';
   import { ipcLink } from 'electron-trpc';

   export const trpcClient = trpc.createTRPCClient({
     links: [ipcLink()],
   });
   ```

4. Now you can use the client in your render process as you normally would (e.g. using `@trpc/react`).
