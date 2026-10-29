import { createTRPCClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';

const trpc = createTRPCClient({
  links: [ipcLink()],
});

async function writeGreeting() {
  const greeting = await trpc.greeting.query({ name: 'Electron' });

  const div = document.createElement('div');
  div.innerText = greeting.text;
  div.setAttribute('data-testid', 'greeting');

  document.body.appendChild(div);
}

function listenForGreetings() {
  trpc.greetings.subscribe(undefined, {
    onData: ({ text }) => {
      console.log(text);
    },
  });
}

writeGreeting();
listenForGreetings();
