import type { Session } from 'electron';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import debugFactory from 'debug';

const debug = debugFactory('electron-trpc:main:registerPreload');

/**
 * Where the preload script may be, in order of preference. Bundlers that understand
 * `new URL(..., import.meta.url)`, like webpack, copy the script into their output and point the
 * first location at the copy. Resolving through the package finds it wherever electron-trpc is still
 * in `node_modules` at runtime.
 */
const preloadLocations = [
  () => fileURLToPath(new URL('./preload-auto.cjs', import.meta.url)),
  () => createRequire(import.meta.url).resolve('electron-trpc/preload-auto'),
];

const findPreloadScript = () => {
  const candidates: string[] = [];
  for (const location of preloadLocations) {
    try {
      const candidate = location();
      // Bundlers may replace these with something that isn't a path at all.
      if (typeof candidate === 'string') candidates.push(candidate);
    } catch {
      // The location can't be resolved in this build, so try the next one.
    }
  }

  const filePath = candidates.find((candidate) => existsSync(candidate));
  if (!filePath) {
    throw new Error(
      [
        "electron-trpc couldn't find its preload script. This happens when your build bundles " +
          'electron-trpc into the main process without including the script, and usually only ' +
          'shows up in packaged apps.',
        'Pass `preload: false` to `createIPCHandler` and call `exposeElectronTRPC()` from your own ' +
          'preload script instead. See https://github.com/jsonnull/electron-trpc#preload-script',
        `Looked in: ${candidates.join(', ') || 'nowhere'}`,
      ].join('\n\n')
    );
  }
  return filePath;
};

/** Registers the electron-trpc preload script on each session until disposed. */
export function registerPreload(sessions: Session[]): Disposable {
  const stack = new DisposableStack();
  const filePath = findPreloadScript();

  for (const session of sessions) {
    debug('Registering preload script', filePath);
    const id = session.registerPreloadScript({ type: 'frame', filePath });
    stack.defer(() => session.unregisterPreloadScript(id));
  }

  return stack;
}
