import React, { useState } from 'react';
import ReactDom from 'react-dom';
import { ipcLink } from 'electron-trpc';
import { createTRPCReact } from '@trpc/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AppRouter } from '../main/api';

const trpcReact = createTRPCReact<AppRouter>();

function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpcReact.createClient({
      links: [ipcLink()],
    })
  );

  return (
    <trpcReact.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <HelloElectron />
      </QueryClientProvider>
    </trpcReact.Provider>
  );
}

function HelloElectron() {
  const { data } = trpcReact.greeting.useQuery({ name: 'Electron' });

  if (!data) {
    return null;
  }

  return <div>{data.text}</div>;
}

ReactDom.render(<App />, document.getElementById('react-root'));
