import type { AnyTRPCRouter, inferRouterContext, TRPCError, TRPCProcedureType } from '@trpc/server';
import type { IpcMainEvent } from 'electron';

export interface CreateContextOptions {
  event: IpcMainEvent;
}

export interface IPCHandlerErrorOptions<TRouter extends AnyTRPCRouter> {
  error: TRPCError;
  type: TRPCProcedureType;
  path: string;
  input: unknown;
  ctx: inferRouterContext<TRouter> | undefined;
  event: IpcMainEvent;
}
