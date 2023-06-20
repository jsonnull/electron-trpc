import { createTRPCProxyClient } from 'https://cdn.jsdelivr.net/npm/@trpc/client@10.31.0/dist/index.js';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../main/api';

(async () => {
  try {
    const client = createTRPCProxyClient<AppRouter>({
      links: [ipcLink()],
    });

    const greetingEl = document.getElementById('greeting');
    const result = await client.greet.query('tRPC via Electron');

    console.log('result:', result);
    if (greetingEl) {
      greetingEl.innerText = result.greeting;
    }

    console.log('from renderer');
  } catch (error) {
    console.error(error);
  }
})();
