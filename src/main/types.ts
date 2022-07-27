import type { ProcedureType } from '@trpc/server';

export interface TRPCHandlerArgs {
  path: string;
  type: ProcedureType;
  input?: unknown;
}
