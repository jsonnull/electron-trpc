import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../main/api';

(async () => {
  const client = createTRPCProxyClient<AppRouter>({
    links: [ipcLink()],
  });

  const greetingEl = document.getElementById('greeting');
  const result = await client.greet.query('tRPC via Electron');

  if (greetingEl) {
    greetingEl.innerText = result.greeting;
  }
})();
