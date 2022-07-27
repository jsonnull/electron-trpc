import type { AnyRouter, inferRouterContext } from "@trpc/server";
import { resolveIPCResponse } from "./resolveIPCResponse";
import { TRPCHandlerArgs } from "./types";

export function createIPCHandler<TRouter extends AnyRouter>({
  createContext,
  router,
}: {
  createContext: () => Promise<inferRouterContext<TRouter>>;
  router: TRouter;
}) {
  return (_event: unknown, opts: TRPCHandlerArgs) => {
    const { input, path, type } = opts;
    return resolveIPCResponse({
      createContext,
      input,
      path,
      router,
      type,
    });
  };
}
