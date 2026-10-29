import type { Session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import debugFactory from 'debug';

const debug = debugFactory('electron-trpc:main:registerPreload');

const resolvePreloadPath = () => {
  if (typeof require !== 'undefined' && typeof require.resolve === 'function') {
    // CommonJS: resolve through the package so this still works when bundled into the app.
    return require.resolve('electron-trpc/preload-auto');
  }
  if (typeof import.meta.url !== 'undefined') {
    // ESM: the preload script sits next to this module in `dist`.
    return path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload-auto.cjs');
  }
  throw new Error('Failed to resolve the electron-trpc preload script path.');
};

/** Registers the electron-trpc preload script on each session until disposed. */
export function registerPreload(sessions: Session[]): Disposable {
  const stack = new DisposableStack();
  const filePath = resolvePreloadPath();

  for (const session of sessions) {
    debug('Registering preload script', filePath);
    const id = session.registerPreloadScript({ type: 'frame', filePath });
    stack.defer(() => session.unregisterPreloadScript(id));
  }

  return stack;
}
