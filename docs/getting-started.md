# Getting Started

## Installation

Follow installation instructions for [trpc](https://trpc.io/docs/quickstart#installation) to build your router and client of choice.

#### pnpm

```sh
pnpm add electron-trpc
```

#### yarn

```sh
yarn add electron-trpc
```

#### npm

```sh
npm install --save electron-trpc
```

## TypeScript

It's worth noting that you'll need to figure out how to get TypeScript working on both the main process and render process client code. For one example of how to do this with a good developer experience (minimal configuration, fast bundling, client hot-reloading) see our [basic example](https://github.com/jsonnull/electron-trpc/tree/main/examples/basic).

## Preload

`electron-trpc` depends on Electron's [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation) feature, and exposes the electron-trpc IPC channel to render processes using a [preload file](https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts).

Some familiarization with these concepts can be helpful in case of unexpected issues during setup.

This is the most minimal working preload file for using `electron-trpc`. Depending on your application, you may need to add this to an existing preload file or customize it later.

::: code-group

```ts [preload.ts]
import { exposeElectronTRPC } from 'electron-trpc/main';

process.once('loaded', async () => {
  exposeElectronTRPC();
});
```

:::

## Main

In the main electron process, you will want to expose a tRPC router to one or more windows. These windows need to use the preload file you created.

::: code-group

```ts{7-10,13} [main.ts]
import { app } from 'electron';
import { createIPCHandler } from 'electron-trpc/main';
import { router } from './api';

app.on('ready', () => {
  const win = new BrowserWindow({
    webPreferences: {
      // Replace this path with the path to your BUILT preload file
      preload: 'path/to/preload.js',
    },
  });

  createIPCHandler({ router, windows: [win] });
});
```

:::

## Renderer

Windows you construct with the preload file and the IPC handler can reach the tRPC router in the main process over IPC. To do this, a script in the window needs to create a tRPC client using the IPC link:

::: code-group

```ts [renderer.ts]
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';

export const client = createTRPCProxyClient({
  links: [ipcLink()],
});
```

:::

To use a different client, follow the appropriate usage instructions in the tRPC docs, ensuring that you substitute any HTTP or websocket links with the `ipcLink`.
