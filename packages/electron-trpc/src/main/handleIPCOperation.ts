import { callProcedure, TRPCError } from '@trpc/server';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import type { IpcMainInvokeEvent } from 'electron';
import { isObservable } from '@trpc/server/observable';
import { Operation } from '@trpc/client';
import { CreateContextOptions } from './types';
import { getTRPCErrorFromUnknown, transformTRPCResponseItem } from './utils';
import { ELECTRON_TRPC_CHANNEL } from '../constants';

export async function handleIPCOperation<TRouter extends AnyRouter>({
  router,
  createContext,
  operation,
  event,
}: {
  router: TRouter;
  createContext?: (opts: CreateContextOptions) => Promise<inferRouterContext<TRouter>>;
  operation: Operation;
  event: IpcMainInvokeEvent;
}) {
  const { type, input: serializedInput, id, path } = operation;
  const input = serializedInput
    ? router._def._config.transformer.input.deserialize(serializedInput)
    : undefined;

  const ctx = (await createContext?.({ event })) ?? {};

  const respond = (response: TRPCResponseMessage) => {
    if (event.sender.isDestroyed()) return;
    event.sender.send(ELECTRON_TRPC_CHANNEL, transformTRPCResponseItem(router, response));
  };

  try {
    const result = await callProcedure({
      ctx,
      path,
      procedures: router._def.procedures,
      rawInput: input,
      type,
    });

    if (type !== 'subscription') {
      respond({
        id,
        result: {
          type: 'data',
          data: result,
        },
      });
      return;
    } else {
      if (!isObservable(result)) {
        throw new TRPCError({
          message: `Subscription ${path} did not return an observable`,
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }

    const subscription = result.subscribe({
      next(data) {
        respond({
          id,
          result: {
            type: 'data',
            data,
          },
        });
      },
      error(err) {
        const error = getTRPCErrorFromUnknown(err);
        respond({
          id,
          error: router.getErrorShape({
            error,
            type,
            path,
            input,
            ctx,
          }),
        });
      },
      complete() {
        respond({
          id,
          result: {
            type: 'stopped',
          },
        });
      },
    });

    event.sender.on('destroyed', () => subscription.unsubscribe());
  } catch (cause) {
    const error: TRPCError = getTRPCErrorFromUnknown(cause);

    return respond({
      id,
      error: router.getErrorShape({
        error,
        type,
        path,
        input,
        ctx,
      }),
    });
  }
}
