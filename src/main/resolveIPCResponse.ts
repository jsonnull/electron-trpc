import type {
  AnyRouter,
  inferRouterContext,
  inferRouterError,
  ProcedureType,
} from '@trpc/server'
import { TRPCError } from '@trpc/server/src/TRPCError'
import { transformTRPCResponse } from '@trpc/server/src/internals/transformTRPCResponse'
import { callProcedure } from '@trpc/server/src/internals/callProcedure'
import { TRPCResponse, TRPCErrorResponse, TRPCResultResponse } from '@trpc/server/rpc'
import { getErrorFromUnknown } from '@trpc/server/src/internals/errors'

export async function resolveIPCResponse<TRouter extends AnyRouter>({
  createContext,
  type,
  input,
  path,
  router,
}: {
  createContext: () => Promise<inferRouterContext<TRouter>>
  input?: unknown
  type: ProcedureType
  path: string
  router: TRouter
}): Promise<TRPCResponse> {
  type TRouterResponse = TRPCErrorResponse<inferRouterError<TRouter>> | TRPCResultResponse<unknown>

  let ctx: inferRouterContext<TRouter> | undefined = undefined

  let json: TRouterResponse
  try {
    if (type === 'subscription') {
      throw new TRPCError({
        message: `Unexpected operation ${type}`,
        code: 'METHOD_NOT_SUPPORTED',
      })
    }

    ctx = await createContext()

    const deserializedInput =
      typeof input !== 'undefined' ? router._def.transformer.input.deserialize(input) : input

    const output = await callProcedure({
      ctx,
      router: router as any,
      path,
      input: deserializedInput,
      type,
    })

    json = {
      id: null,
      result: {
        type: 'data',
        data: output,
      },
    }
  } catch (cause) {
    const error = getErrorFromUnknown(cause)

    json = {
      id: null,
      error: router.getErrorShape({
        error,
        type,
        path,
        input,
        ctx,
      }),
    }
  }

  return transformTRPCResponse(router as any, json) as any
}
