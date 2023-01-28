import type { Operation } from '@trpc/client';
import type { TRPCResponseMessage } from '@trpc/server/rpc';

export interface RendererGlobalElectronTRPC {
  sendMessage: (args: Operation) => void;
  onMessage: (callback: (args: TRPCResponseMessage) => void) => void;
}
