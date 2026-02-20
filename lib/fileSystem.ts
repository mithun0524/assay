import { WebContainer, WebContainerProcess } from '@webcontainer/api';
import { getWebContainer } from './webcontainer';
import { useStore } from './store';
import { getLanguageFromPath } from './utils';

let devServerProcess: WebContainerProcess | null = null;

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

  // Open the file in the editor so it's visible
  store.openTab(filePath);
}

export async function runShellInSandbox(command: string): Promise<number> {
  const wc = await getWebContainer();
  const { appendTerminal } = useStore.getState();
  const [cmd, ...args] = command.trim().split(/\s+/);
  appendTerminal(`\n$ ${command}\n`);
  const process = await wc.spawn(cmd, args);
  process.output.pipeTo(
    new WritableStream({ write(data) { appendTerminal(data); } })
  );
  return process.exit;
}

export async function stopDevServer() {
  if (devServerProcess) {
    devServerProcess.kill();
    devServerProcess = null;
    useStore.getState().setSandboxStatus('idle');
    useStore.getState().appendTerminal('\n🛑 Dev server stopped.\n');
  }
}

export async function installDependencies() {
  const wc = await getWebContainer();
  const { appendTerminal, setSandboxStatus } = useStore.getState();

  setSandboxStatus('installing');
  appendTerminal('\n📦 Installing dependencies...\n');

  const process = await wc.spawn('npm', ['install']);

  process.output.pipeTo(
    new WritableStream({ write: (data) => appendTerminal(data) })
  );

  const exitCode = await process.exit;
  if (exitCode !== 0) {
    appendTerminal(`\n❌ Installation failed with code ${exitCode}\n`);
    setSandboxStatus('error');
    throw new Error('Installation failed');
  } else {
    appendTerminal('\n✅ Dependencies installed\n');
    setSandboxStatus('idle');
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