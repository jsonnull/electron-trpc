---
'electron-trpc': major
---

Breaking change: `createIPCHandler` returns a `Disposable` handler that serves every window, replacing the `windows` option and `attachWindow`/`detachWindow`. `autoRegisterPreload: false` is now `preload: false`, and `preload: { sessions }` registers the preload script on sessions other than the default. Requests are cancelled when their page navigates away, reloads, crashes or closes.
