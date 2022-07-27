# electron-trpc

Add your tRPC router to the electron main process using `createIPCHandler`:

```ts
import { app, ipcMain } from 'electron';
import { createIPCHandler } from 'electron-trpc';
// This is your tRPC router
import { router, createContext } from './api';

app.on('ready', () => {
  // ...

  ipcMain.handle('rpc', createIPCHandler({ router, createContext }));

  // ...
});
```

Expose the IPC to the render process in the preload file:

```ts
// preload.ts
import { contextBridge, ipcRenderer } from 'electron'
import{ exposeElectronTRPC } from 'electron-trpc'

contextBridge.exposeInMainWorld('electron-trpc', exposeElectronTRPC(ipcRenderer));
```

When creating the client in the render process, use the ipcLink (instead of the HTTP or batch HTTP links):

```ts
import * as trpc from '@trpc/client';
import { ipcLink } from 'electron-trpc'

export const trpcClient = trpc.createClient({
  links: [ipcLink()],
})
```

Now you can use the client in your render process as you normally would (e.g. using `@trpc/react`).
