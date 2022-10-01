import { callProcedure, TRPCError } from '@trpc/server';
import type { AnyRouter, inferRouterContext, inferRouterError } from '@trpc/server';
import type { TRPCResponse } from '@trpc/server/rpc';
import type { IPCResponse } from './types';
import { Operation } from '@trpc/client';
import { getTRPCErrorFromUnknown, transformTRPCResponseItem } from './utils'

export async function resolveIPCResponse<TRouter extends AnyRouter>({
  router,
  createContext,
  operation,
}: {
  router: TRouter;
  createContext?: () => Promise<inferRouterContext<TRouter>>;
  operation: Operation;
}): Promise<IPCResponse> {
  const { type, input: serializedInput } = operation;
  const { transformer } = router._def;
  const deserializedInput = transformer.input.deserialize(serializedInput) as unknown;

  type TRouterError = inferRouterError<TRouter>;
  type TRouterResponse = TRPCResponse<unknown, TRouterError>;

  const ctx = await createContext?.() ?? {};

  if (type === 'subscription') {
    throw new TRPCError({
      message: 'Subscriptions should use wsLink',
      code: 'METHOD_NOT_SUPPORTED',
    });
  }

  type RawResult =
    | { input: unknown; path: string; data: unknown }
    | { input: unknown; path: string; error: TRPCError };

  async function getRawResult(ctx: inferRouterContext<TRouter>): Promise<RawResult> {
    const { path, type } = operation;
    const { procedures } = router._def;

    try {
      const output = await callProcedure({
        ctx,
        path,
        procedures,
        rawInput: deserializedInput,
        type,
      });
      return {
        input: deserializedInput,
        path,
        data: output,
      };
    } catch (cause) {
      const error = getTRPCErrorFromUnknown(cause);
      return {
        input: deserializedInput,
        path,
        error,
      };
    }
  }

  function getResultEnvelope(rawResult: RawResult): TRouterResponse {
    const { path, input } = rawResult;

    if ('error' in rawResult) {
      return {
        error: router.getErrorShape({
          error: rawResult.error,
          type,
          path,
          input,
          ctx,
        }),
      };
    } else {
      return {
        result: {
          data: rawResult.data,
        },
      };
    }
  }

  function getEndResponse(envelope: TRouterResponse): IPCResponse {
    const transformed = transformTRPCResponseItem(router, envelope);

    return {
      response: transformed,
    };
  }

  try {
    const rawResult = await getRawResult(ctx);
    const resultEnvelope = getResultEnvelope(rawResult);

    return getEndResponse(resultEnvelope);
  } catch (cause) {
    const { input, path } = operation;
    // we get here if
    // - `createContext()` throws
    // - input deserialization fails
    const error = getTRPCErrorFromUnknown(cause);
    const resultEnvelope = getResultEnvelope({ input, path, error });

    return getEndResponse(resultEnvelope);
  }
}
