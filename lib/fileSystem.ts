import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { getWebContainer } from './webcontainer';
import { useStore } from './store';
import { getLanguageFromPath } from './utils';

let devServerProcess: WebContainerProcess | null = null;

// Mutex to prevent concurrent npm install processes from deadlocking
let installLock: Promise<void> | null = null;

export async function writeFileToSandbox(filePath: string, content: string) {
  const wc = await getWebContainer();
  const dir = filePath.split('/').slice(0, -1).join('/');
  if (dir) {
    await wc.fs.mkdir(dir, { recursive: true }).catch(() => { });
  }
  await wc.fs.writeFile(filePath, content);

  const store = useStore.getState();
  store.setFile(filePath, {
    content,
    language: getLanguageFromPath(filePath),
  });
}

export async function runShellInSandbox(command: string, timeoutMs = 180000): Promise<number> {
  const wc = await getWebContainer();
  const { appendTerminal } = useStore.getState();
  const [cmd, ...args] = command.trim().split(/\s+/);
  appendTerminal(`\n$ ${command}\n`);
  const proc = await wc.spawn(cmd, args);

  const streamAbort = new AbortController();
  proc.output.pipeTo(
    new WritableStream({ write(data) { appendTerminal(data); } }),
    { signal: streamAbort.signal }
  ).catch(() => {});

  const exitCode = await Promise.race([
    proc.exit,
    new Promise<number>((resolve) =>
      setTimeout(() => {
        streamAbort.abort();
        proc.kill();
        appendTerminal(`\n⚠️ Command timed out after ${timeoutMs / 1000}s: ${command}\n`);
        resolve(1);
      }, timeoutMs)
    ),
  ]);

  return exitCode;
}

export async function stopDevServer() {
  if (devServerProcess) {
    devServerProcess.kill();
    devServerProcess = null;
    useStore.getState().setSandboxStatus('idle');
    useStore.getState().appendTerminal('\n🛑 Dev server stopped.\n');
  }
}

export async function installDependencies(retries = 2) {
  // If an install is already running, wait for it instead of starting a second one.
  // Two concurrent `npm install` processes in the same WebContainer deadlock on the
  // node_modules lock — this was the root cause of the infinite-hang bug.
  if (installLock) {
    await installLock;
    return;
  }

  let unlock: () => void;
  installLock = new Promise<void>((resolve) => { unlock = resolve; });

  const wc = await getWebContainer();
  const { appendTerminal, setSandboxStatus } = useStore.getState();

  setSandboxStatus('installing');
  appendTerminal('\n📦 Installing dependencies...\n');

  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        appendTerminal(`\n🔄 Retrying installation (attempt ${attempt + 1}/${retries + 1})...\n`);
        // Brief pause before retry to let the container settle
        await new Promise((r) => setTimeout(r, 2000));
      }

      const proc = await wc.spawn('npm', ['install']);

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
    throw new Error('Installation failed');
  } finally {
    installLock = null;
    unlock!();
  }
}

export async function startDevServerInSandbox(): Promise<string> {
  const wc = await getWebContainer();
  const { appendTerminal, setSandboxStatus, setPreviewUrl } = useStore.getState();

  // Kill existing server if running
  if (devServerProcess) {
    devServerProcess.kill();
  }

  setSandboxStatus('starting');
  appendTerminal('\n🚀 Starting dev server...\n');

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => {
        setSandboxStatus('error');
        reject(new Error('Dev server timed out after 30s'));
      },
      30000
    );

    wc.on('server-ready', (port, url) => {
      clearTimeout(timeout);
      appendTerminal(`\n✅ Server ready at ${url}\n`);
      setSandboxStatus('ready');
      setPreviewUrl(url);
      resolve(url);
    });

    wc.on('error', (err) => {
      clearTimeout(timeout);
      appendTerminal(`\n❌ Error: ${err.message}\n`);
      setSandboxStatus('error');
      reject(err);
    });

    wc.spawn('npm', ['run', 'dev']).then((proc) => {
      devServerProcess = proc;
      proc.output.pipeTo(
        new WritableStream({ write: (data) => appendTerminal(data) })
      );
      proc.exit.then((code) => {
        if (code !== 0 && devServerProcess === proc) {
          appendTerminal(`\n⚠️ Dev server exited with code ${code}\n`);
          setSandboxStatus('error');
        }
      });
    });
  });
}

export async function restartDevServer() {
  await stopDevServer();
  return startDevServerInSandbox();
}