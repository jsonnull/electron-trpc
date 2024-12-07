import { ipcLink } from 'electron-trpc/renderer';
import { createTRPCProxyClient } from '@trpc/client';

const trpc = createTRPCProxyClient({
  links: [ipcLink()],
});

async function writeGreeting() {
  const greeting = await trpc.greeting.query({ name: 'Electron' });

  console.log('greeting', greeting);

  const div = document.createElement('div');
  div.innerText = greeting.text;
  div.setAttribute('data-testid', 'greeting');

  document.body.appendChild(div);
}

async function listenForSubscription() {
  trpcReact.subscription.subscribe(undefined, {
    onData: (data) => {
      console.log(data);
    },
  });
}

writeGreeting();
listenForSubscription();
