import { Operation, TRPCClientError, TRPCLink } from '@trpc/client';
import type { AnyRouter, inferRouterContext, ProcedureType } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import type { RendererGlobalElectronTRPC } from '../types';
import { observable, Observer } from '@trpc/server/observable';
import { transformResult } from './utils';
import debugFactory from 'debug';

const debug = debugFactory('electron-trpc:renderer:ipcLink');

type IPCCallbackResult<TRouter extends AnyRouter = AnyRouter> = TRPCResponseMessage<
  unknown,
  inferRouterContext<TRouter>
>;

type IPCCallbacks<TRouter extends AnyRouter = AnyRouter> = Observer<
  IPCCallbackResult<TRouter>,
  TRPCClientError<TRouter>
>;

type IPCRequest = {
  type: ProcedureType;
  callbacks: IPCCallbacks;
  op: Operation;
};

const getElectronTRPC = () => {
  const electronTRPC: RendererGlobalElectronTRPC = (globalThis as any).electronTRPC;

  if (!electronTRPC) {
    throw new Error(
      'Could not find `electronTRPC` global. Check that `exposeElectronTRPC` has been called in your preload file.'
    );
  }

  return electronTRPC;
};

class IPCClient {
  #pendingRequests = new Map<string | number, IPCRequest>();
  #electronTRPC = getElectronTRPC();

  constructor() {
    this.#electronTRPC.onMessage((response: TRPCResponseMessage) => {
      this.#handleResponse(response);
    });
  }

  #handleResponse(response: TRPCResponseMessage) {
    debug('handling response', response);
    const request = response.id && this.#pendingRequests.get(response.id);
    if (!request) {
      return;
    }

    request.callbacks.next(response);

    if ('result' in response && response.result.type === 'stopped') {
      request.callbacks.complete();
    }
  }

  request(op: Operation, callbacks: IPCCallbacks) {
    const { type, id } = op;

    this.#pendingRequests.set(id, {
      type,
      callbacks,
      op,
    });

    this.#electronTRPC.sendMessage({ method: 'request', operation: op });

    return () => {
      const callbacks = this.#pendingRequests.get(id)?.callbacks;

      this.#pendingRequests.delete(id);

      callbacks?.complete();

      if (type === 'subscription') {
        this.#electronTRPC.sendMessage({
          id,
          method: 'subscription.stop',
        });
      }
    };
  }
}

export function ipcLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return (runtime) => {
    const client = new IPCClient();

    return ({ op }) => {
      return observable((observer) => {
        op.input = runtime.transformer.serialize(op.input);

        const unsubscribe = client.request(op, {
          error(err) {
            observer.error(err as TRPCClientError<any>);
            unsubscribe();
          },
          complete() {
            observer.complete();
          },
          next(response) {
            const transformed = transformResult(response, runtime);

            if (!transformed.ok) {
              observer.error(TRPCClientError.from(transformed.error));
              return;
            }

            observer.next({ result: transformed.result });

            if (op.type !== 'subscription') {
              unsubscribe();
              observer.complete();
            }
          },
        });

        return () => {
          unsubscribe();
        };
      });
    };
  };
}
