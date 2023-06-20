import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../main/api';

(async () => {
  const incrementBtn = document.querySelector<HTMLButtonElement>('[data-testid="increment-btn"]');
  const countP = document.querySelector<HTMLParagraphElement>('[data-testid="count-p"]');
  const greetingEl = document.querySelector<HTMLElement>('[data-testid="greeting"]');

  // setup tRPC client
  const client = createTRPCProxyClient<AppRouter>({
    links: [ipcLink()],
  });

  client.counter.onCount.subscribe(null, {
    onData: ({ count }) => {
      countP.innerText = count.toString();
    },
  });

  const result = await client.greeting.query({ name: 'Electron' });

  // set the greeting text
  greetingEl.innerText = result.text;

  incrementBtn.addEventListener('click', async () => {
    await client.counter.increment.mutate();
  });
})();
