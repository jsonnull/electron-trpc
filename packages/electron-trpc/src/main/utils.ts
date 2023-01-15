import { AnyRouter, TRPCError } from '@trpc/server';
import { TRPCResponse, TRPCResponseMessage } from '@trpc/server/rpc';

// from @trpc/server/src/error/utils
export function getTRPCErrorFromUnknown(cause: unknown): TRPCError {
  const error = getErrorFromUnknown(cause);
  // this should ideally be an `instanceof TRPCError` but for some reason that isn't working
  // ref https://github.com/trpc/trpc/issues/331
  if (error.name === 'TRPCError') {
    return cause as TRPCError;
  }

  const trpcError = new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    cause: error,
    message: error.message,
  });

  // Inherit stack from error
  trpcError.stack = error.stack;

  return trpcError;
}

// from @trpc/server/src/error/utils
function getErrorFromUnknown(cause: unknown): Error {
  if (cause instanceof Error) {
    return cause;
  }
  const message = getMessageFromUnkownError(cause, 'Unknown error');
  return new Error(message);
}

// from @trpc/server/src/error/utils
function getMessageFromUnkownError(err: unknown, fallback: string): string {
  if (typeof err === 'string') {
    return err;
  }

  if (err instanceof Error && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}

// from @trpc/server/src/internals/transformTRPCResonse
export function transformTRPCResponseItem<TResponseItem extends TRPCResponse | TRPCResponseMessage>(
  router: AnyRouter,
  item: TResponseItem
): TResponseItem {
  // explicitly use appRouter instead of router argument: https://github.com/trpc/trpc/issues/2804
  if ('error' in item) {
    return {
      ...item,
      error: router._def._config.transformer.output.serialize(item.error) as unknown,
    };
  }

  if ('data' in item.result) {
    return {
      ...item,
      result: {
        ...item.result,
        data: router._def._config.transformer.output.serialize(item.result.data) as unknown,
      },
    };
  }

  return item;
}
