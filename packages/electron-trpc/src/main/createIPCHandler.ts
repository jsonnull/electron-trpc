import type { AnyTRPCRouter, inferRouterContext } from '@trpc/server';
import { ipcMain, session } from 'electron';
import type { IpcMainEvent, Session, WebContents } from 'electron';
import debugFactory from 'debug';
import { handleRequest } from './handleRequest';
import { registerPreload } from './registerPreload';
import type { CreateContextOptions, IPCHandlerErrorOptions } from './types';
import { WebContentsScope } from './WebContentsScope';
import { ELECTRON_TRPC_CHANNEL } from '../constants';
import type { ETRPCRequest } from '../types';

const debug = debugFactory('electron-trpc:main:IPCHandler');

export interface CreateIPCHandlerOptions<TRouter extends AnyTRPCRouter> {
  router: TRouter;
  /**
   * Decides whether to handle a request, e.g. by checking `event.senderFrame.url`. Requests it
   * rejects fail with a `FORBIDDEN` error. Every request is allowed by default, so set this when
   * your app loads content you don't trust, which electron-trpc is exposed to like any other page.
   */
  allow?: (event: IpcMainEvent) => boolean;
  createContext?: (
    opts: CreateContextOptions
  ) => inferRouterContext<TRouter> | Promise<inferRouterContext<TRouter>>;
  onError?: (opts: IPCHandlerErrorOptions<TRouter>) => void;
  /**
   * Sessions to register the electron-trpc preload script on, which exposes electron-trpc to every
   * page in them. Defaults to the default session. Pass `false` to call `exposeElectronTRPC` from
   * your own preload script instead.
   */
  preload?: false | { sessions: Session[] };
}

/** Handles electron-trpc requests from every renderer until disposed. */
export interface IPCHandler extends Disposable {}

class IPCHandlerImpl<TRouter extends AnyTRPCRouter> implements IPCHandler {
  readonly #stack: DisposableStack;
  readonly #contents = new Map<number, WebContentsScope>();

  constructor(private readonly options: CreateIPCHandlerOptions<TRouter>) {
    // Undoes whatever was already set up if anything below throws.
    using stack = new DisposableStack();

    const listener = (event: IpcMainEvent, request: ETRPCRequest) => {
      this.#handleMessage(event, request);
    };
    ipcMain.on(ELECTRON_TRPC_CHANNEL, listener);
    stack.defer(() => ipcMain.off(ELECTRON_TRPC_CHANNEL, listener));

    if (options.preload !== false) {
      stack.use(registerPreload(options.preload?.sessions ?? [session.defaultSession]));
    }

    stack.defer(() => {
      for (const scope of this.#contents.values()) scope[Symbol.dispose]();
      this.#contents.clear();
    });

    this.#stack = stack.move();
  }

  #contentsScope(webContents: WebContents) {
    const id = webContents.id;
    let scope = this.#contents.get(id);
    if (!scope) {
      debug('Tracking webContents', id);
      scope = new WebContentsScope(webContents, () => {
        debug('webContents destroyed', id);
        this.#contents.get(id)?.[Symbol.dispose]();
        this.#contents.delete(id);
      });
      this.#contents.set(id, scope);
    }
    return scope;
  }

  #handleMessage(event: IpcMainEvent, request: ETRPCRequest) {
    // The sending frame has already navigated or been destroyed, so there is no one to reply to.
    const frame = event.senderFrame;
    if (!frame || event.sender.isDestroyed()) return;

    const contents = this.#contentsScope(event.sender);

    if (request.method === 'stop') {
      contents.findClient(frame, request.clientId)?.stop(request.id);
      return;
    }

    const operation = contents.client(frame, request.clientId)?.start(request.operation.id);
    if (!operation) return;

    void handleRequest({
      router: this.options.router,
      allow: this.options.allow,
      createContext: this.options.createContext,
      onError: this.options.onError,
      event,
      request: request.operation,
      operation,
    });
  }

  [Symbol.dispose]() {
    this.#stack.dispose();
  }
}

export const createIPCHandler = <TRouter extends AnyTRPCRouter>(
  options: CreateIPCHandlerOptions<TRouter>
): IPCHandler => {
  if (ipcMain.listenerCount(ELECTRON_TRPC_CHANNEL) > 0) {
    throw new Error(
      'An electron-trpc IPC handler is already active. Dispose it before creating another.'
    );
  }
  return new IPCHandlerImpl(options);
};
