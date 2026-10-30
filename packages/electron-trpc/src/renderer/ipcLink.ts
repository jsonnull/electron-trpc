import { TRPCClientError } from '@trpc/client';
import type { Operation, TRPCLink } from '@trpc/client';
import { getTransformer } from '@trpc/client/unstable-internals';
import type { TransformerOptions } from '@trpc/client/unstable-internals';
import type { AnyTRPCRouter, inferTRPCClientTypes } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { transformResult } from '@trpc/server/unstable-core-do-not-import';
import debugFactory from 'debug';
import type { ETRPCRequest, ETRPCResponse, RendererGlobalElectronTRPC } from '../types';

const debug = debugFactory('electron-trpc:renderer:ipcLink');

const getElectronTRPC = () => {
  const electronTRPC: RendererGlobalElectronTRPC | undefined = (globalThis as any).electronTRPC;

  if (!electronTRPC) {
    throw new Error(
      'Could not find `electronTRPC` global. `createIPCHandler` registers a preload script that ' +
        'exposes it, unless it was created with `preload: false`, in which case your own preload ' +
        'script needs to call `exposeElectronTRPC`.'
    );
  }

  return electronTRPC;
};

// Ids only need to tell this page's clients apart, so fall back to Math.random on insecure origins.
const createClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface PendingRequest {
  type: Operation['type'];
  onMessage: (message: TRPCResponseMessage) => void;
}

const isFinalMessage = (type: Operation['type'], message: TRPCResponseMessage) =>
  'error' in message || type !== 'subscription' || message.result.type === 'stopped';

/**
 * The renderer side of one tRPC client. It only listens for responses while it has requests in
 * flight, so a client that is no longer used doesn't leave a listener behind.
 */
class IPCClient {
  readonly #id = createClientId();
  readonly #electronTRPC = getElectronTRPC();
  readonly #pending = new Map<number, PendingRequest>();
  #removeListener: (() => void) | undefined;

  request(
    { id, type, path, input }: Pick<Operation, 'id' | 'type' | 'path' | 'input'>,
    onMessage: PendingRequest['onMessage']
  ): Disposable {
    this.#removeListener ??= this.#electronTRPC.onMessage((response) =>
      this.#handleResponse(response)
    );
    this.#pending.set(id, { type, onMessage });
    this.#send({ method: 'request', clientId: this.#id, operation: { id, type, path, input } });

    return {
      [Symbol.dispose]: () => {
        // Already finished, so the main process has nothing left to stop.
        if (!this.#settle(id)) return;
        this.#send({ method: 'stop', clientId: this.#id, id });
      },
    };
  }

  #send(request: ETRPCRequest) {
    this.#electronTRPC.sendMessage(request);
  }

  #handleResponse({ clientId, message }: ETRPCResponse) {
    if (clientId !== this.#id) return;
    debug('Handling response', message);

    const request = message.id == null ? undefined : this.#pending.get(Number(message.id));
    if (!request) return;

    if (isFinalMessage(request.type, message)) this.#settle(Number(message.id));
    request.onMessage(message);
  }

  /** Stops tracking a request. Returns whether it was still pending. */
  #settle(id: number) {
    if (!this.#pending.delete(id)) return false;
    if (this.#pending.size === 0) {
      this.#removeListener?.();
      this.#removeListener = undefined;
    }
    return true;
  }
}

export type IPCLinkOptions<TRouter extends AnyTRPCRouter> = TransformerOptions<
  inferTRPCClientTypes<TRouter>
>;

/** Options are only required when the router has a transformer, which then has to be passed. */
type IPCLinkArgs<TRouter extends AnyTRPCRouter> =
  inferTRPCClientTypes<TRouter>['transformer'] extends true
    ? [opts: IPCLinkOptions<TRouter>]
    : [opts?: IPCLinkOptions<TRouter>];

export function ipcLink<TRouter extends AnyTRPCRouter>(
  ...[opts]: IPCLinkArgs<TRouter>
): TRPCLink<TRouter> {
  const transformer = getTransformer(opts?.transformer);

  return () => {
    const client = new IPCClient();

    return ({ op }) =>
      observable((observer) => {
        if (op.signal?.aborted) {
          observer.complete();
          return;
        }

        const request = client.request(
          { ...op, input: transformer.input.serialize(op.input) },
          (message) => {
            let transformed: ReturnType<typeof transformResult>;
            try {
              transformed = transformResult(message, transformer.output);
            } catch (cause) {
              observer.error(TRPCClientError.from(cause as Error));
              return;
            }

            if (!transformed.ok) {
              observer.error(TRPCClientError.from(transformed.error));
              return;
            }

            observer.next({ result: transformed.result });
            if (isFinalMessage(op.type, message)) observer.complete();
          }
        );

        const onAbort = () => observer.complete();
        op.signal?.addEventListener('abort', onAbort, { once: true });

        return () => {
          op.signal?.removeEventListener('abort', onAbort);
          request[Symbol.dispose]();
        };
      });
  };
}
