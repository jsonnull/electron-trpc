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

electron-trpc requires Electron 35 or later and tRPC 11.

```sh
# Using pnpm
pnpm add electron-trpc

# Using yarn
yarn add electron-trpc

# Using npm
npm install --save electron-trpc
```

## Basic Setup

1. Add your tRPC router to the Electron main process using `createIPCHandler`. It also registers a preload script that exposes electron-trpc to your pages, so create it before loading any:

   ```ts
   import { app, BrowserWindow } from 'electron';
   import { createIPCHandler } from 'electron-trpc/main';
   import { router } from './api';

   app.on('ready', () => {
     createIPCHandler({ router });

     const win = new BrowserWindow();
     win.loadFile('index.html');
   });
   ```

   The handler serves every window and cleans up after pages that navigate away or close. It is `Disposable`, so `handler[Symbol.dispose]()` stops it and ends any running subscriptions.

2. When creating the client in the render process, use `ipcLink` instead of the HTTP or WebSocket links. If your router uses a transformer, pass it to the link:

   ```ts
   import { createTRPCClient } from '@trpc/client';
   import { ipcLink } from 'electron-trpc/renderer';
   import superjson from 'superjson';
   import type { AppRouter } from './api';

   export const client = createTRPCClient<AppRouter>({
     links: [ipcLink({ transformer: superjson })],
   });
   ```

3. Now you can use the client in your render process as you normally would, for example with `@trpc/tanstack-react-query`.

## Preload Script

`createIPCHandler` registers electron-trpc's preload script on Electron's default session. If your windows use other sessions, pass them instead:

```ts
createIPCHandler({ router, preload: { sessions: [session.fromPartition('persist:app')] } });
```

The preload script is a file in the electron-trpc package, so your packaged app has to include it. That doesn't need any setup when:

- Your app includes electron-trpc in `node_modules`, for example as a `dependency` packaged by electron-builder, whether or not your main process is bundled.
- Your main process is bundled with webpack, as in electron-forge's webpack template. webpack copies the preload script into its output.

If your build bundles electron-trpc into the main process without including its preload script, `createIPCHandler` throws an error saying it couldn't find the preload script. This usually happens when electron-trpc is a `devDependency`, or when your packager only includes your bundled code. It usually only shows up in packaged apps, so test a packaged build of your app.

To fix it, expose electron-trpc from your own preload script. Pass `preload: false` and call `exposeElectronTRPC` there:

```ts
// main process
createIPCHandler({ router, preload: false });

// preload script
import { exposeElectronTRPC } from 'electron-trpc/preload';

exposeElectronTRPC();
```

> Note: `electron-trpc` depends on `contextIsolation` being enabled, which is the default.

## Restricting Access

The preload script exposes electron-trpc to every page in its sessions. That includes remote content your app loads in those sessions. To only handle requests from pages you trust, check the sender with `allow`. Requests it rejects fail with a `FORBIDDEN` error:

```ts
createIPCHandler({
  router,
  allow: (event) => new URL(event.senderFrame?.url ?? '').protocol === 'app:',
});
```
