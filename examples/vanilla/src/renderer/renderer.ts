import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc';
// the type import causes an error: Failed to load resource: net::ERR_FILE_NOT_FOUND. that's probably a tsconfig option thing
// import type { AppRouter } from '../main/api';

// index.html:1 Uncaught TypeError: Failed to resolve module specifier "@trpc/client". Relative references must start with either "/", "./", or "../".
// const client = createTRPCProxyClient<any>({
//   links: [ipcLink()],
// });

const greetingEl = document.getElementById('greeting');
// const result = await client.greet.query('tRPC via Electron');
const result = { greeting: 'hi there, hello' };

if (greetingEl) {
  greetingEl.innerText = result.greeting;
}

console.log('from renderer');
