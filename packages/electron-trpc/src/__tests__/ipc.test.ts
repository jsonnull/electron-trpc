import { EventEmitter, on } from 'node:events';
import { createTRPCClient, TRPCClientError } from '@trpc/client';
import { initTRPC, tracked, TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import z from 'zod';
import { createIPCHandler } from '../main';
import type { CreateIPCHandlerOptions, IPCHandler } from '../main';
import { ipcLink } from '../renderer';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { ETRPCRequest } from '../types';
import {
  FakeDocument,
  FakeSession,
  FakeWebContents,
  flush,
  ipcMain,
  reset,
  session,
} from './fakeElectron';

vi.mock('electron', () => import('./fakeElectron'));

const createRouter = () => {
  const t = initTRPC.context<{ webContentsId: number }>().create();
  const ee = new EventEmitter();
  const probe = {
    aborted: [] as string[],
    finished: [] as string[],
    contextRequested: Promise.withResolvers<void>(),
    releaseContext: Promise.withResolvers<void>(),
  };

  const router = t.router({
    echo: t.procedure.input(z.string()).query(({ input }) => input),
    whoami: t.procedure.query(({ ctx }) => ctx.webContentsId),
    add: t.procedure
      .input(z.object({ a: z.number(), b: z.number() }))
      .mutation(({ input }) => input.a + input.b),
    forbidden: t.procedure.query(() => {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Not allowed' });
    }),
    hang: t.procedure.input(z.string()).query(
      ({ input, signal }) =>
        new Promise((resolve) => {
          signal?.addEventListener('abort', () => {
            probe.aborted.push(input);
            resolve(null);
          });
        })
    ),
    streamedQuery: t.procedure.query(async function* () {
      yield 1;
    }),
    events: t.procedure.input(z.string()).subscription(async function* ({ input, signal }) {
      try {
        for await (const [value] of on(ee, 'event', { signal })) yield value as string;
      } catch (cause) {
        if (!signal?.aborted) throw cause;
      } finally {
        probe.finished.push(input);
      }
    }),
    count: t.procedure.input(z.number()).subscription(async function* ({ input }) {
      for (let i = 1; i <= input; i++) yield i;
    }),
    trackedCount: t.procedure.input(z.number()).subscription(async function* ({ input }) {
      for (let i = 1; i <= input; i++) yield tracked(`event-${i}`, i);
    }),
    failing: t.procedure.subscription(async function* () {
      yield 'first';
      throw new TRPCError({ code: 'CONFLICT', message: 'Stream broke' });
    }),
    observed: t.procedure.subscription(() =>
      observable<number>((emit) => {
        emit.next(1);
        emit.next(2);
        return () => probe.finished.push('observed');
      })
    ),
  });

  return { router, ee, probe };
};

type AppRouter = ReturnType<typeof createRouter>['router'];

const createClient = (document: FakeDocument) =>
  document.run(() => createTRPCClient<AppRouter>({ links: [ipcLink()] }));

let handler: IPCHandler | undefined;
const startHandler = (options: Partial<CreateIPCHandlerOptions<AppRouter>> = {}) => {
  const app = createRouter();
  handler = createIPCHandler({
    router: app.router,
    createContext: ({ event }) => ({ webContentsId: event.sender.id }),
    ...options,
  });
  return app;
};

beforeEach(() => reset());
afterEach(() => {
  handler?.[Symbol.dispose]();
  handler = undefined;
});

describe('procedures', () => {
  test('runs queries and mutations', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    await expect(client.echo.query('hello')).resolves.toBe('hello');
    await expect(client.add.mutate({ a: 2, b: 3 })).resolves.toBe(5);
  });

  test('creates context from the IPC event', async () => {
    startHandler();
    const contents = new FakeWebContents();

    await expect(createClient(contents.mainFrame.document).whoami.query()).resolves.toBe(
      contents.id
    );
  });

  test('rejects with a TRPCClientError carrying the error shape', async () => {
    const onError = vi.fn();
    startHandler({ onError });
    const client = createClient(new FakeWebContents().mainFrame.document);

    const error = await client.forbidden.query().catch((cause) => cause);

    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error.message).toBe('Not allowed');
    expect(error.data).toMatchObject({ code: 'FORBIDDEN', path: 'forbidden' });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'forbidden', type: 'query', error: expect.any(TRPCError) })
    );
  });

  test('reports input validation errors', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    // @ts-expect-error -- deliberately invalid input
    const error = await client.echo.query(42).catch((cause) => cause);

    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error.data).toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('rejects queries that return an async iterable', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const error = await client.streamedQuery.query().catch((cause) => cause);

    expect(error.data).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  test('aborts the procedure when the caller aborts', async () => {
    const { probe } = startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);
    const controller = new AbortController();

    const result = client.hang.query('aborted query', { signal: controller.signal });
    await flush();
    controller.abort();

    await expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(probe.aborted).toEqual(['aborted query']));
  });
});

describe('access', () => {
  test('rejects requests that `allow` denies, without running them', async () => {
    const contents = new FakeWebContents();
    const subframe = contents.addSubframe();
    const createContext = vi.fn(() => ({ webContentsId: contents.id }));
    const onError = vi.fn();
    startHandler({
      allow: (event) => event.senderFrame === (contents.mainFrame as unknown),
      createContext,
      onError,
    });

    await expect(createClient(contents.mainFrame.document).echo.query('allowed')).resolves.toBe(
      'allowed'
    );
    const error = await createClient(subframe.document)
      .echo.query('denied')
      .catch((cause) => cause);

    expect(error).toBeInstanceOf(TRPCClientError);
    expect(error.data).toMatchObject({ code: 'FORBIDDEN' });
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'echo',
        error: expect.objectContaining({ code: 'FORBIDDEN' }),
      })
    );
  });
});

describe('transformers', () => {
  test('round-trips inputs and outputs through superjson', async () => {
    const t = initTRPC.create({ transformer: superjson });
    const router = t.router({
      roundTrip: t.procedure
        .input(z.object({ date: z.date(), big: z.bigint(), set: z.set(z.string()) }))
        .query(({ input }) => input),
    });
    handler = createIPCHandler({ router });
    const document = new FakeWebContents().mainFrame.document;
    const client = document.run(() =>
      createTRPCClient<typeof router>({ links: [ipcLink({ transformer: superjson })] })
    );

    const input = { date: new Date('2000-01-01T01:23:45Z'), big: 12345n, set: new Set(['a']) };

    await expect(client.roundTrip.query(input)).resolves.toEqual(input);
  });

  test('requires the transformer when the router has one', () => {
    const t = initTRPC.create({ transformer: superjson });
    const router = t.router({});

    // @ts-expect-error -- the router has a transformer, so the link needs it too
    ipcLink<typeof router>();
    // @ts-expect-error -- and a router without one doesn't accept it
    ipcLink<AppRouter>({ transformer: superjson });
  });
});

describe('subscriptions', () => {
  const collect = <T>(
    subscribe: (handlers: {
      onStarted: () => void;
      onData: (value: T) => void;
      onError: (error: unknown) => void;
      onComplete: () => void;
    }) => { unsubscribe: () => void }
  ) => {
    const state = {
      started: false,
      values: [] as T[],
      error: undefined as unknown,
      complete: false,
    };
    const subscription = subscribe({
      onStarted: () => (state.started = true),
      onData: (value) => state.values.push(value),
      onError: (error) => (state.error = error),
      onComplete: () => (state.complete = true),
    });
    return Object.assign(state, { unsubscribe: () => subscription.unsubscribe() });
  };

  test('streams values from an async generator until it returns', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<number>((handlers) => client.count.subscribe(3, handlers));

    await vi.waitFor(() => expect(sub.complete).toBe(true));
    expect(sub.started).toBe(true);
    expect(sub.values).toEqual([1, 2, 3]);
  });

  test('passes tracked event ids through', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<{ id: string; data: number }>((handlers) =>
      client.trackedCount.subscribe(2, handlers)
    );

    await vi.waitFor(() => expect(sub.complete).toBe(true));
    expect(sub.values).toEqual([
      { id: 'event-1', data: 1 },
      { id: 'event-2', data: 2 },
    ]);
  });

  test('supports observables', async () => {
    const { probe } = startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<number>((handlers) => client.observed.subscribe(undefined, handlers));
    await vi.waitFor(() => expect(sub.values).toEqual([1, 2]));
    sub.unsubscribe();

    await vi.waitFor(() => expect(probe.finished).toEqual(['observed']));
  });

  test('delivers an error thrown mid-stream', async () => {
    startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<string>((handlers) => client.failing.subscribe(undefined, handlers));

    await vi.waitFor(() => expect(sub.error).toBeInstanceOf(TRPCClientError));
    expect(sub.values).toEqual(['first']);
    expect((sub.error as TRPCClientError<AppRouter>).data).toMatchObject({ code: 'CONFLICT' });
  });

  test('stops the generator when the renderer unsubscribes', async () => {
    const { ee, probe } = startHandler();
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<string>((handlers) => client.events.subscribe('sub', handlers));
    await vi.waitFor(() => expect(sub.started).toBe(true));
    ee.emit('event', 'one');
    await vi.waitFor(() => expect(sub.values).toEqual(['one']));

    sub.unsubscribe();
    await vi.waitFor(() => expect(probe.finished).toEqual(['sub']));

    ee.emit('event', 'two');
    await flush();
    expect(sub.values).toEqual(['one']);
  });

  test('stops a subscription that is cancelled while its context is still being created', async () => {
    const app = createRouter();
    handler = createIPCHandler({
      router: app.router,
      createContext: async ({ event }) => {
        app.probe.contextRequested.resolve();
        await app.probe.releaseContext.promise;
        return { webContentsId: event.sender.id };
      },
    });
    const client = createClient(new FakeWebContents().mainFrame.document);

    const sub = collect<string>((handlers) => client.events.subscribe('early stop', handlers));
    await app.probe.contextRequested.promise;
    sub.unsubscribe();
    await flush();
    app.probe.releaseContext.resolve();
    await flush();

    app.ee.emit('event', 'too late');
    await flush();
    expect(sub.values).toEqual([]);
    expect(app.ee.listenerCount('event')).toBe(0);
  });
});

describe('clients', () => {
  test('routes responses to the client that made the request', async () => {
    startHandler();
    const document = new FakeWebContents().mainFrame.document;
    const first = createClient(document);
    const second = createClient(document);

    // Both clients number their operations from the same starting id.
    const results = await Promise.all([first.echo.query('first'), second.echo.query('second')]);

    expect(results).toEqual(['first', 'second']);
  });

  test('only listens for responses while requests are in flight', async () => {
    const { ee } = startHandler();
    const document = new FakeWebContents().mainFrame.document;
    const client = createClient(document);
    expect(document.listenerCount).toBe(0);

    await client.echo.query('hello');
    expect(document.listenerCount).toBe(0);

    const subscription = client.events.subscribe('sub', {});
    expect(document.listenerCount).toBe(1);
    await flush();
    ee.emit('event', 'value');
    subscription.unsubscribe();
    expect(document.listenerCount).toBe(0);
  });
});

describe('protocol', () => {
  const hang = (id: number, input: string, clientId = 'client'): ETRPCRequest => ({
    method: 'request',
    clientId,
    operation: { id, type: 'query', path: 'hang', input },
  });

  // Operations still running when the handler is disposed get aborted, so this lists them.
  const runningOperations = async (probe: { aborted: string[] }) => {
    handler![Symbol.dispose]();
    handler = undefined;
    await flush();
    return probe.aborted;
  };

  test('ignores malformed messages, even with `allow` rejecting everything', async () => {
    startHandler({ allow: () => false });
    const document = new FakeWebContents().mainFrame.document;
    const send = (message: unknown) => document.electronTRPC.sendMessage(message as ETRPCRequest);

    send(null);
    send('request');
    send({ method: 'request', clientId: 'client' });
    send({
      method: 'request',
      clientId: 'client',
      operation: { id: 1, type: 'delete', path: 'echo' },
    });
    send({ method: 'stop', clientId: 42, id: 1 });
    await flush();

    const error = await createClient(document)
      .echo.query('still handled')
      .catch((cause) => cause);
    expect(error.data).toMatchObject({ code: 'FORBIDDEN' });
  });

  test('ignores requests that reuse a client id from another frame', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    const subframe = contents.addSubframe();

    contents.mainFrame.document.electronTRPC.sendMessage(hang(1, 'main frame'));
    await flush();
    subframe.document.electronTRPC.sendMessage(hang(2, 'subframe'));
    await flush();

    expect(await runningOperations(probe)).toEqual(['main frame']);
  });

  test('ignores a request that reuses an operation id still in flight', async () => {
    const { probe } = startHandler();
    const { electronTRPC } = new FakeWebContents().mainFrame.document;

    electronTRPC.sendMessage(hang(1, 'first'));
    electronTRPC.sendMessage(hang(1, 'duplicate'));
    await flush();

    expect(await runningOperations(probe)).toEqual(['first']);
  });
});

describe('document lifetimes', () => {
  const subscribe = (document: FakeDocument, name: string) =>
    createClient(document).events.subscribe(name, {});

  test('stops subscriptions when the main frame navigates to a new document', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    subscribe(contents.mainFrame.document, 'main');
    subscribe(contents.addSubframe().document, 'subframe');
    await flush();

    contents.navigate(contents.mainFrame);

    await vi.waitFor(() => expect(probe.finished.sort()).toEqual(['main', 'subframe']));
  });

  test('stops subscriptions when the new document gets a new frame host', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    subscribe(contents.mainFrame.document, 'main');
    await flush();

    contents.navigate(contents.mainFrame, { newHost: true });

    await vi.waitFor(() => expect(probe.finished).toEqual(['main']));
  });

  test('only stops subscriptions in the subframe that navigated', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    // Routing ids 2 and 23 share a prefix, which used to stop both.
    const navigating = contents.addSubframe(2);
    subscribe(navigating.document, 'navigating');
    subscribe(contents.addSubframe(23).document, 'sibling');
    subscribe(contents.mainFrame.document, 'main');
    await flush();

    contents.navigate(navigating);

    await vi.waitFor(() => expect(probe.finished).toEqual(['navigating']));
    await flush();
    expect(probe.finished).toEqual(['navigating']);
  });

  test('keeps subscriptions through same-document and uncommitted navigations', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    subscribe(contents.mainFrame.document, 'main');
    await flush();

    contents.navigateInPage(contents.mainFrame);
    contents.startNavigation(contents.mainFrame);
    await flush();

    expect(probe.finished).toEqual([]);
  });

  test('does not deliver responses to the next document in the frame', async () => {
    const { ee } = startHandler();
    const contents = new FakeWebContents();
    const values: string[] = [];
    createClient(contents.mainFrame.document).events.subscribe('old', {
      onData: (value) => values.push(value),
    });
    await flush();

    contents.navigate(contents.mainFrame);
    const next = contents.mainFrame.document;
    createClient(next).events.subscribe('new', {});
    await flush();
    ee.emit('event', 'after navigation');
    await flush();

    expect(values).toEqual([]);
  });

  test('stops subscriptions when the renderer process crashes', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    subscribe(contents.mainFrame.document, 'main');
    await flush();

    contents.crash();

    await vi.waitFor(() => expect(probe.finished).toEqual(['main']));
  });

  test('stops subscriptions and stops listening when the webContents is destroyed', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    subscribe(contents.mainFrame.document, 'main');
    await flush();

    contents.destroy();

    await vi.waitFor(() => expect(probe.finished).toEqual(['main']));
    expect(contents.listenerCount('did-frame-navigate')).toBe(0);
    expect(contents.listenerCount('render-process-gone')).toBe(0);
  });

  test('ignores requests from a frame that is already gone', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    const frame = contents.addSubframe();
    const client = createClient(frame.document);

    void client.hang.query('from a removed frame').catch(() => {});
    frame.detached = true;
    frame.destroyed = true;
    await flush();

    expect(probe.aborted).toEqual([]);
  });
});

describe('handler lifetime', () => {
  test('stops everything and stops listening when disposed', async () => {
    const { probe } = startHandler();
    const contents = new FakeWebContents();
    createClient(contents.mainFrame.document).events.subscribe('main', {});
    await flush();

    handler![Symbol.dispose]();
    handler = undefined;

    await vi.waitFor(() => expect(probe.finished).toEqual(['main']));
    expect(ipcMain.listenerCount(ELECTRON_TRPC_CHANNEL)).toBe(0);
    expect(contents.listenerCount('did-frame-navigate')).toBe(0);
  });

  test('allows only one active handler', () => {
    startHandler();
    const { router } = createRouter();

    expect(() => createIPCHandler({ router })).toThrow(/already active/);

    handler![Symbol.dispose]();
    handler = createIPCHandler({ router });
  });

  test('registers the preload script on the default session until disposed', () => {
    startHandler();
    const { defaultSession } = session;

    expect(defaultSession.registerPreloadScript).toHaveBeenCalledWith({
      type: 'frame',
      filePath: expect.stringMatching(/preload-auto\.cjs$/),
    });
    expect(defaultSession.preloads.size).toBe(1);

    handler![Symbol.dispose]();
    handler = undefined;
    expect(defaultSession.preloads.size).toBe(0);
  });

  test('registers the preload script on the given sessions instead', () => {
    const sessions = [new FakeSession(), new FakeSession()];
    startHandler({ preload: { sessions: sessions as unknown as Electron.Session[] } });

    expect(session.defaultSession.registerPreloadScript).not.toHaveBeenCalled();
    expect(sessions.map((s) => s.preloads.size)).toEqual([1, 1]);
  });

  test('does not register the preload script with `preload: false`', () => {
    startHandler({ preload: false });

    expect(session.defaultSession.registerPreloadScript).not.toHaveBeenCalled();
  });
});
