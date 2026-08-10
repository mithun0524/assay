import type { WebContainerProcess } from '@webcontainer/api';
import { getWebContainer } from './webcontainer';
import { normalizeSandboxPath, detectDevCommand } from './sandboxUtils';
import { useStore } from './store';
import { getLanguageFromPath } from './utils';

let devServerProcess: WebContainerProcess | null = null;

// Mutex to prevent concurrent npm install processes from deadlocking
let installLock: Promise<void> | null = null;

export async function writeFileToSandbox(filePath: string, content: string) {
  const path = normalizeSandboxPath(filePath);
  if (!path) {
    console.warn('[sandbox] refusing to write unusable path:', filePath);
    return;
  }

  const wc = await getWebContainer();
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true }).catch(() => { });
  }
  await wc.fs.writeFile(path, content);

  const store = useStore.getState();
  store.setFile(path, {
    content,
    language: getLanguageFromPath(path),
  });
}

/** Remove a file from both the sandbox and the store. */
export async function deleteFileFromSandbox(filePath: string): Promise<boolean> {
  const path = normalizeSandboxPath(filePath);
  if (!path) return false;
  try {
    const wc = await getWebContainer();
    await wc.fs.rm(path, { force: true });
  } catch (err) {
    console.warn('[sandbox] delete failed:', path, err);
    return false;
  }
  useStore.getState().deleteFile(path);
  return true;
}

/** Read a file back out of the sandbox — lets an agent inspect what actually landed. */
export async function readFileFromSandbox(filePath: string): Promise<string | null> {
  const path = normalizeSandboxPath(filePath);
  if (!path) return null;
  try {
    const wc = await getWebContainer();
    return await wc.fs.readFile(path, 'utf-8');
  } catch {
    return null;
  }
}



export async function runShellInSandbox(command: string, timeoutMs = 180000): Promise<number> {
  const wc = await getWebContainer();
  const { appendTerminal, addTerminalError } = useStore.getState();
  const [cmd, ...args] = command.trim().split(/\s+/);
  if (!cmd) return 0;
  appendTerminal(`\n$ ${command}\n`);

  let proc: WebContainerProcess;
  try {
    proc = await wc.spawn(cmd, args);
  } catch (err) {
    const msg = `Failed to run "${command}": ${err instanceof Error ? err.message : String(err)}`;
    appendTerminal(`\n❌ ${msg}\n`);
    addTerminalError(msg);
    return 1;
  }

  const streamAbort = new AbortController();
  proc.output.pipeTo(
    new WritableStream({ write(data) { appendTerminal(data); } }),
    { signal: streamAbort.signal }
  ).catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  const exitCode = await Promise.race([
    proc.exit,
    new Promise<number>((resolve) => {
      timer = setTimeout(() => {
        streamAbort.abort();
        proc.kill();
        const msg = `Command timed out after ${timeoutMs / 1000}s: ${command}`;
        appendTerminal(`\n⚠️ ${msg}\n`);
        addTerminalError(msg);
        resolve(1);
      }, timeoutMs);
    }),
  ]);
  if (timer) clearTimeout(timer);

  // A non-zero exit used to vanish silently — the QA gate needs to see it.
  if (exitCode !== 0) {
    const msg = `Command failed (exit ${exitCode}): ${command}`;
    appendTerminal(`\n❌ ${msg}\n`);
    addTerminalError(msg);
  }

  return exitCode;
}

export async function stopDevServer() {
  if (devServerProcess) {
    devServerProcess.kill();
    devServerProcess = null;
    useStore.getState().setSandboxStatus('idle');
    useStore.getState().setPreviewUrl(null);
    useStore.getState().appendTerminal('\n🛑 Dev server stopped.\n');
  }
}

/**
 * Empty the sandbox so the next project starts on bare ground.
 *
 * Switching or creating a project used to clear the store and nothing else. The
 * WebContainer kept every file from the previous project and kept serving it,
 * so the new project was written on top of the old one: the preview showed the
 * previous app, and any file the new project did not happen to overwrite stayed
 * behind — in the build, and in the file context handed to the agent.
 *
 * node_modules is kept by default. Deleting it costs a full reinstall on every
 * switch, and the install that follows reconciles the new package.json anyway.
 * Pass keepNodeModules: false when the dependency tree itself is suspect.
 */
export async function resetSandbox({ keepNodeModules = true } = {}): Promise<void> {
  await stopDevServer();

  let wc: Awaited<ReturnType<typeof getWebContainer>>;
  try {
    wc = await getWebContainer();
  } catch {
    // No container booted yet — nothing to clear, and forcing one to boot just
    // to empty it would be slower than letting the next write create it.
    return;
  }

  let entries: string[];
  try {
    entries = await wc.fs.readdir('/', { withFileTypes: false }) as unknown as string[];
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((name) => !(keepNodeModules && name === 'node_modules'))
      .map((name) =>
        wc.fs.rm(`/${name}`, { recursive: true, force: true }).catch(() => {
          // A file the container is still holding open is not worth failing the
          // whole switch over; the new project will overwrite it.
        }),
      ),
  );
}

export async function installDependencies(retries = 2) {
  // If an install is already running, wait for it instead of starting a second one.
  // Two concurrent `npm install` processes in the same WebContainer deadlock on the
  // node_modules lock — this was the root cause of the infinite-hang bug.
  if (installLock) {
    await installLock;
    return;
  }

  // Nothing to install without a manifest; npm would just error out.
  if (!useStore.getState().files['package.json']) {
    return;
  }

  let unlock: () => void;
  installLock = new Promise<void>((resolve) => { unlock = resolve; });

  const wc = await getWebContainer();
  const { appendTerminal, setSandboxStatus, addTerminalError } = useStore.getState();

  setSandboxStatus('installing');
  appendTerminal('\n📦 Installing dependencies...\n');

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        appendTerminal(`\n🔄 Retrying installation (attempt ${attempt + 1}/${retries + 1})...\n`);
        // Brief pause before retry to let the container settle
        await new Promise((r) => setTimeout(r, 2000));
      }

      const proc = await wc.spawn('npm', ['install', '--no-audit', '--no-fund']);

      proc.output.pipeTo(
        new WritableStream({ write: (data) => appendTerminal(data) })
      ).catch(() => {});

      const exitCode = await proc.exit;

      if (exitCode === 0) {
        appendTerminal('\n✅ Dependencies installed\n');
        setSandboxStatus('idle');
        return;
      }

      appendTerminal(`\n❌ Installation failed with code ${exitCode}\n`);
    }

    setSandboxStatus('error');
    addTerminalError('npm install failed — dependencies are missing or a package name is wrong.');
    throw new Error('Installation failed');
  } finally {
    installLock = null;
    unlock!();
  }
}

const DEV_SERVER_TIMEOUT_MS = 90_000;

export async function startDevServerInSandbox(): Promise<string> {
  const wc = await getWebContainer();
  const { appendTerminal, setSandboxStatus, setPreviewUrl, addTerminalError } = useStore.getState();

  // Kill existing server if running
  if (devServerProcess) {
    devServerProcess.kill();
    devServerProcess = null;
  }

  setSandboxStatus('starting');
  const { cmd, args } = detectDevCommand();
  appendTerminal(`\n🚀 Starting dev server (${cmd} ${args.join(' ')})...\n`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let proc: WebContainerProcess | null = null;

    // WebContainer's `on` returns an unsubscribe function. Not calling it meant
    // every restart stacked another live listener on the same container.
    let offReady = () => {};
    let offError = () => {};

    const finish = () => {
      settled = true;
      clearTimeout(timeout);
      offReady();
      offError();
    };

    const timeout = setTimeout(() => {
      if (settled) return;
      finish();
      proc?.kill(); // don't leave an orphan build running in the container
      const msg = `Dev server did not become ready within ${DEV_SERVER_TIMEOUT_MS / 1000}s`;
      appendTerminal(`\n❌ ${msg}\n`);
      addTerminalError(msg);
      setSandboxStatus('error');
      reject(new Error(msg));
    }, DEV_SERVER_TIMEOUT_MS);

    offReady = wc.on('server-ready', (_port: number, url: string) => {
      if (settled) return;
      finish();
      appendTerminal(`\n✅ Server ready at ${url}\n`);
      setSandboxStatus('ready');
      setPreviewUrl(url);
      resolve(url);
    });

    offError = wc.on('error', (err: { message: string }) => {
      if (settled) return;
      finish();
      appendTerminal(`\n❌ Error: ${err.message}\n`);
      addTerminalError(err.message);
      setSandboxStatus('error');
      reject(new Error(err.message));
    });

    wc.spawn(cmd, args)
      .then((spawned) => {
        proc = spawned;
        devServerProcess = spawned;
        spawned.output.pipeTo(
          new WritableStream({ write: (data) => appendTerminal(data) })
        ).catch(() => {});

        spawned.exit.then((code) => {
          // Only update status if this is still the active server process
          // and the promise hasn't already been settled by server-ready/error/timeout
          if (code !== 0 && devServerProcess === spawned && useStore.getState().sandboxStatus !== 'ready') {
            appendTerminal(`\n⚠️ Dev server exited with code ${code}\n`);
            addTerminalError(`Dev server exited with code ${code}`);
            setSandboxStatus('error');
            if (!settled) {
              finish();
              reject(new Error(`Dev server exited with code ${code}`));
            }
          }
        });
      })
      .catch((err) => {
        if (settled) return;
        finish();
        const msg = err instanceof Error ? err.message : String(err);
        appendTerminal(`\n❌ Failed to start dev server: ${msg}\n`);
        addTerminalError(msg);
        setSandboxStatus('error');
        reject(err);
      });
  });
}

export async function restartDevServer() {
  await stopDevServer();
  return startDevServerInSandbox();
}

export { normalizeSandboxPath, detectDevCommand, readPackageJson } from './sandboxUtils';
