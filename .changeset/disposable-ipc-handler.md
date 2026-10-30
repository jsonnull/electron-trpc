---
'electron-trpc': major
---

Breaking change: `createIPCHandler` returns a `Disposable` handler that serves every window, replacing the `windows` option and `attachWindow`/`detachWindow`. Requests are cancelled when their page navigates away, reloads, crashes or closes, and disposing the handler cancels everything still running.
