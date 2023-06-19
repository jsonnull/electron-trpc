import type { AnyRouter, inferRouterError } from '@trpc/server';
import type { TRPCResponse, TRPCResponseMessage, TRPCResultMessage } from '@trpc/server/rpc';
import type { TRPCClientRuntime } from '@trpc/client';

// from @trpc/client/src/links/internals/transformResult
// FIXME:
// - the generics here are probably unnecessary
// - the RPC-spec could probably be simplified to combine HTTP + WS
/** @internal */
export function transformResult<TRouter extends AnyRouter, TOutput>(
  response:
    | TRPCResponseMessage<TOutput, inferRouterError<TRouter>>
    | TRPCResponse<TOutput, inferRouterError<TRouter>>,
  runtime: TRPCClientRuntime
) {
  if ('error' in response) {
    const error = runtime.transformer.deserialize(response.error) as inferRouterError<TRouter>;
    return {
      ok: false,
      error: {
        ...response,
        error,
      },
    } as const;
  }

  const result = {
    ...response.result,
    ...((!response.result.type || response.result.type === 'data') && {
      type: 'data',
      data: runtime.transformer.deserialize(response.result.data) as unknown,
    }),
  } as TRPCResultMessage<TOutput>['result'];
  return { ok: true, result } as const;
}
