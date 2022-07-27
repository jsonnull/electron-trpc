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

From the render process, use the ipcLink (instead of the HTTP or batch HTTP links) to reach the main process:

```ts
import { QueryClient, QueryClientProvider } from 'react-query'
import { createReactQueryHooks } from '@trpc/react'
import { ipcLink } from 'electron-trpc'

import type { AppRouter } from ''../main'

const trpc = createReactQueryHooks<AppRouter>()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
    },
  },
})

const trpcClient = trpc.createClient({
  links: [ipcLink()],
})

function MyApp() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* ... */}
      </QueryClientProvider>
    </trpc.Provider>
  )
}

export default MyApp
```

Now you can write queries as you normally would using the React client
