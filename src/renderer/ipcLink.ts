import type { AnyRouter } from '@trpc/server';
import type { TRPCLink, LinkRuntimeOptions } from '@trpc/client';
import { transformRPCResponse, TRPCAbortError, TRPCClientError } from '@trpc/client';

export function ipcLink<TRouter extends AnyRouter>(): TRPCLink<TRouter> {
  return (runtime: LinkRuntimeOptions) => {
    return ({ op, prev, onDestroy }) => {
      const promise = (window as any).electronTRPC.rpc(op);
      let isDone = false;

      const prevOnce: typeof prev = (result) => {
        if (isDone) {
          return;
        }
        isDone = true;
        prev(result);
      };

      onDestroy(() => {
        prevOnce(TRPCClientError.from(new TRPCAbortError(), { isDone: true }));
      });

      promise
        .then((envelope: any) => {
          const response = transformRPCResponse({ envelope, runtime });
          prevOnce(response);
        })
        .catch((cause: any) => {
          prevOnce(TRPCClientError.from(cause));
        });
    };
  };
}
