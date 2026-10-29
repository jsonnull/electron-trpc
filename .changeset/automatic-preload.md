---
'electron-trpc': major
---

Breaking change: `createIPCHandler` registers electron-trpc's preload script itself, on the default session or the sessions passed as `preload: { sessions }`, so apps no longer need one. Apps that expose electron-trpc from their own preload script pass `preload: false` and import `exposeElectronTRPC` from `electron-trpc/preload` instead of `electron-trpc/main`.
