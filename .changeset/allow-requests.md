---
'electron-trpc': minor
---

Add an `allow` option to `createIPCHandler`, which decides whether to handle each request, e.g. based on `event.senderFrame.url`. Rejected requests fail with a `FORBIDDEN` error.
