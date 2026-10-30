import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { createTRPCClient } from '@trpc/client';
import { createTRPCContext, useSubscription } from '@trpc/tanstack-react-query';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '../electron/api';

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTRPCClient<AppRouter>({ links: [ipcLink()] }));

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <HelloElectron />
      </TRPCProvider>
    </QueryClientProvider>
  );
}

function HelloElectron() {
  const trpc = useTRPC();
  const greeting = useQuery(trpc.greeting.queryOptions({ name: 'Electron' }));
  const greet = useMutation(trpc.greet.mutationOptions());
  const [greetings, setGreetings] = useState<string[]>([]);
  const subscription = useSubscription(
    trpc.greetings.subscriptionOptions(undefined, {
      onData: ({ text }) => setGreetings((previous) => [...previous, text]),
    })
  );

  if (!greeting.data) {
    return null;
  }

  return (
    <>
      <div data-testid="greeting">{greeting.data.text}</div>
      <button
        data-testid="greet"
        disabled={subscription.status !== 'pending'}
        onClick={() => greet.mutate({ name: 'Electron' })}
      >
        Greet
      </button>
      {greet.data && <div data-testid="subscribers">Subscribers: {greet.data.subscribers}</div>}
      <ul data-testid="greetings">
        {greetings.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </>
  );
}

createRoot(document.getElementById('react-root')!).render(<App />);
