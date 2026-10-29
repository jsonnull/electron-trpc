import {
  callTRPCProcedure,
  getTRPCErrorFromUnknown,
  getTRPCErrorShape,
  isTrackedEnvelope,
  transformTRPCResponse,
  TRPCError,
} from '@trpc/server';
import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server';
import { isObservable, observableToAsyncIterable } from '@trpc/server/observable';
import type { TRPCResponseMessage, TRPCResultMessage } from '@trpc/server/rpc';
import type { IpcMainEvent } from 'electron';
import type { Operation } from './ClientScope';
import type { CreateContextOptions, IPCHandlerErrorOptions } from './types';
import type { ETRPCRequest } from '../types';

type MaybePromise<T> = T | Promise<T>;

export interface HandleRequestOptions<TRouter extends AnyTRPCRouter> {
  router: TRouter;
  createContext?: (opts: CreateContextOptions) => MaybePromise<inferRouterContext<TRouter>>;
  onError?: (opts: IPCHandlerErrorOptions<TRouter>) => void;
  event: IpcMainEvent;
  request: Extract<ETRPCRequest, { method: 'request' }>['operation'];
  operation: Operation;
}

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
  value != null && typeof value === 'object' && Symbol.asyncIterator in value;

/**
 * Resolves with the iterator's next result, or with `'aborted'` once `signal` aborts. Listening for
 * the abort per call, rather than racing one long-lived promise, keeps a long subscription from
 * accumulating a promise reaction for every value it yields.
 */
const nextOrAbort = <T>(iterator: AsyncIterator<T>, signal: AbortSignal) =>
  new Promise<IteratorResult<T> | 'aborted'>((resolve, reject) => {
    if (signal.aborted) return resolve('aborted');
    const onAbort = () => resolve('aborted');
    signal.addEventListener('abort', onAbort, { once: true });
    iterator
      .next()
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', onAbort));
  });

export async function handleRequest<TRouter extends AnyTRPCRouter>({
  router,
  createContext,
  onError,
  event,
  request: { id, type, path, input: serializedInput },
  operation,
}: HandleRequestOptions<TRouter>) {
  using _operation = operation;
  const { signal } = operation;
  const config = router._def._config;
  let input: unknown = undefined;
  let ctx: inferRouterContext<TRouter> | undefined = undefined;

  const respond = (message: TRPCResponseMessage) => {
    // Transforming a single message yields a single message; the return type covers batches too.
    operation.send(transformTRPCResponse(config, message) as TRPCResponseMessage);
  };

  try {
    input =
      serializedInput === undefined
        ? undefined
        : config.transformer.input.deserialize(serializedInput);
    ctx = await createContext?.({ event });

    const result = await callTRPCProcedure({
      router,
      path,
      getRawInput: async () => input,
      ctx,
      type,
      signal,
      batchIndex: 0,
    });

    if (type !== 'subscription') {
      if (isAsyncIterable(result) || isObservable(result)) {
        throw new TRPCError({
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: `Cannot return an async iterable or observable from a ${type} procedure over IPC`,
        });
      }
      respond({ id, result: { type: 'data', data: result } });
      return;
    }

    if (!isAsyncIterable(result) && !isObservable(result)) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Subscription ${path} did not return an observable or an async iterable`,
      });
    }

    const iterable = isObservable(result) ? observableToAsyncIterable(result, signal) : result;
    const iterator = iterable[Symbol.asyncIterator]();
    respond({ id, result: { type: 'started' } });

    try {
      while (true) {
        const next = await nextOrAbort(iterator, signal);
        if (next === 'aborted' || next.done) break;

        const result: TRPCResultMessage<unknown>['result'] = isTrackedEnvelope(next.value)
          ? { type: 'data', id: next.value[0], data: { id: next.value[0], data: next.value[1] } }
          : { type: 'data', data: next.value };
        respond({ id, result });
      }
    } finally {
      // Don't wait: a generator suspended on something other than `signal` only returns once that
      // settles, and nothing is listening for this operation anymore.
      Promise.resolve(iterator.return?.()).catch(() => {});
    }

    respond({ id, result: { type: 'stopped' } });
  } catch (cause) {
    if (signal.aborted) return;

    const error = getTRPCErrorFromUnknown(cause);
    onError?.({ error, type, path, input, ctx, event });
    respond({ id, error: getTRPCErrorShape({ config, error, type, path, input, ctx }) });
  }
}
