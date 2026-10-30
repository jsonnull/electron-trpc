import type { WebFrameMain } from 'electron';
import type { TRPCResponseMessage } from '@trpc/server/rpc';
import debugFactory from 'debug';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { ETRPCResponse } from '../types';

const debug = debugFactory('electron-trpc:main:ClientScope');

/**
 * A single in-flight procedure call. Disposing it aborts its signal, which is passed to the
 * procedure, and stops any further responses from reaching the renderer.
 */
export class Operation implements Disposable {
  readonly #controller = new AbortController();

  constructor(
    readonly id: number,
    private readonly client: ClientScope
  ) {}

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  send(message: TRPCResponseMessage) {
    if (this.signal.aborted) return;
    this.client.send(message);
  }

  [Symbol.dispose]() {
    this.#controller.abort();
    this.client.release(this);
  }
}

/**
 * Everything one renderer-side client has in flight. A client lives in a single frame, so it is
 * disposed when that frame navigates away or is destroyed.
 */
export class ClientScope implements Disposable {
  readonly #operations = new Map<number, Operation>();

  constructor(
    readonly frame: WebFrameMain,
    readonly clientId: string,
    private readonly onEmpty: (client: ClientScope) => void
  ) {}

  /** Whether the frame this client lives in still exists in the frame tree. */
  get isLive(): boolean {
    return !this.frame.isDestroyed() && !this.frame.detached;
  }

  /** Starts tracking an operation, or returns `undefined` if its id is already in flight. */
  start(id: number): Operation | undefined {
    if (this.#operations.has(id)) {
      debug('Ignoring duplicate operation id', this.clientId, id);
      return undefined;
    }

    const operation = new Operation(id, this);
    this.#operations.set(id, operation);
    return operation;
  }

  stop(id: number) {
    this.#operations.get(id)?.[Symbol.dispose]();
  }

  send(message: TRPCResponseMessage) {
    // Electron has no event for a removed iframe, so this may be the first sign its frame is gone.
    if (!this.isLive) {
      debug('Frame is gone, stopping client', this.clientId);
      this[Symbol.dispose]();
      return;
    }
    const response: ETRPCResponse = { clientId: this.clientId, message };
    this.frame.send(ELECTRON_TRPC_CHANNEL, response);
  }

  release(operation: Operation) {
    if (this.#operations.get(operation.id) !== operation) return;
    this.#operations.delete(operation.id);
    if (this.#operations.size === 0) this.onEmpty(this);
  }

  [Symbol.dispose]() {
    for (const operation of [...this.#operations.values()]) {
      operation[Symbol.dispose]();
    }
  }
}
