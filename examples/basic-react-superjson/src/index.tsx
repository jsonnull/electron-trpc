import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { createTRPCClient } from '@trpc/client';
import { createTRPCContext, useSubscription } from '@trpc/tanstack-react-query';
import { ipcLink } from 'electron-trpc/renderer';
import superjson from 'superjson';
import type { AppRouter } from '../electron/api';

const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({ links: [ipcLink({ transformer: superjson })] })
  );

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
  useSubscription(
    trpc.greetings.subscriptionOptions(undefined, {
      onData: ({ text, at }) => console.log(text, at.toISOString()),
    })
  );

  if (!greeting.data) {
    return null;
  }

  return (
    <>
      <div data-testid="greeting">{greeting.data.text}</div>
      {/* superjson turns this back into a `Date`, so it has `getFullYear`. */}
      <div data-testid="greeted-year">{greeting.data.greetedAt.getFullYear()}</div>
    </>
  );
}

createRoot(document.getElementById('react-root')!).render(<App />);
