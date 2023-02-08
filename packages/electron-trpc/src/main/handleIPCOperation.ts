import { callProcedure, TRPCError } from '@trpc/server';
import type { AnyRouter, inferRouterContext } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import type { IpcMainInvokeEvent } from 'electron';
import { isObservable } from '@trpc/server/observable';
import { Operation } from '@trpc/client';
import { getTRPCErrorFromUnknown, transformTRPCResponseItem } from './utils';

export async function handleIPCOperation<TRouter extends AnyRouter>({
  router,
  createContext,
  operation,
  respond,
  event
}: {
  router: TRouter;
  createContext?: (event: IpcMainInvokeEvent) => Promise<inferRouterContext<TRouter>>;
  operation: Operation;
  respond: (response: TRPCResponseMessage) => void;
  event: IpcMainInvokeEvent;
}) {
  const { type, input: serializedInput, id, path } = operation;
  const input = router._def._config.transformer.input.deserialize(serializedInput);

  // type TSuccessResponse = TRPCSuccessResponse<inferRouterContext<TRouter>>;
  // type TErrorResponse = TRPCErrorResponse<inferRouterError<TRouter>>;

  const ctx = (await createContext?.(event)) ?? {};

  try {
    const result = await callProcedure({
      ctx,
      path,
      procedures: router._def.procedures,
      rawInput: input,
      type,
    });

    if (type !== 'subscription') {
      const response = transformTRPCResponseItem(router, {
        id,
        result: {
          type: 'data',
          data: result,
        },
      });

      respond(response);
      return;
    } else {
      // result is an observable
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
        // opts.onError?.({ error, path, type, ctx, req, input });
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

    event.sender.on("destroyed", () => subscription.unsubscribe());
  } catch (cause) {
    const error: TRPCError = getTRPCErrorFromUnknown(cause);

    const response = transformTRPCResponseItem(router, {
      error: router.getErrorShape({
        error,
        type,
        path,
        input,
        ctx,
      }),
    });

    return respond({id, ...response});
  }
}
