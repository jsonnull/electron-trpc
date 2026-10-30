import type { TRPCProcedureType } from '@trpc/server';
import type { TRPCResponseMessage } from '@trpc/server/rpc';

/**
 * A message from a renderer to the main process. `clientId` identifies the renderer-side client,
 * since operation ids are only unique within a single client.
 */
export type ETRPCRequest =
  | {
      method: 'request';
      clientId: string;
      operation: { id: number; type: TRPCProcedureType; path: string; input: unknown };
    }
  | { method: 'stop'; clientId: string; id: number };

/** A message from the main process to the renderer-side client identified by `clientId`. */
export interface ETRPCResponse {
  clientId: string;
  message: TRPCResponseMessage;
}

export interface RendererGlobalElectronTRPC {
  sendMessage: (request: ETRPCRequest) => void;
  /** Returns a function that removes the listener. */
  onMessage: (callback: (response: ETRPCResponse) => void) => () => void;
}
