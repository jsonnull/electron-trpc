import { Operation, TRPCClientError, TRPCLink } from '@trpc/client';
import type {
  AnyTRPCRouter,
  inferRouterContext,
  TRPCProcedureType,
  inferTRPCClientTypes,
} from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import { observable, Observer } from '@trpc/server/observable';
import debugFactory from 'debug';
import { type TransformerOptions, getTransformer } from '@trpc/client/unstable-internals';
import type { RendererGlobalElectronTRPC } from '../types';
import { transformResult } from './utils';

const debug = debugFactory('electron-trpc:renderer:ipcLink');

type IPCCallbackResult<TRouter extends AnyTRPCRouter = AnyTRPCRouter> = TRPCResponseMessage<
  unknown,
  inferRouterContext<TRouter>
>;

type IPCCallbacks<TRouter extends AnyTRPCRouter = AnyTRPCRouter> = Observer<
  IPCCallbackResult<TRouter>,
  TRPCClientError<TRouter>
>;

type IPCRequest = {
  type: TRPCProcedureType;
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

export type IPCLinkOptions<TRouter extends AnyTRPCRouter> = TransformerOptions<
  inferTRPCClientTypes<TRouter>
>;

export function ipcLink<TRouter extends AnyTRPCRouter>(
  opts?: IPCLinkOptions<TRouter>
): TRPCLink<TRouter> {
  return () => {
    const client = new IPCClient();
    const transformer = getTransformer(opts?.transformer);

    return ({ op }) => {
      return observable((observer) => {
        op.input = transformer.input.serialize(op.input);

        const unsubscribe = client.request(op, {
          error(err) {
            observer.error(err as TRPCClientError<any>);
            unsubscribe();
          },
          complete() {
            observer.complete();
          },
          next(response) {
            const transformed = transformResult(response, transformer.output);

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
