import { toast } from 'sonner';
import { detectMissingDependencies, shouldCheckFile, isValidPackageName } from './dependencyDetector';
import { runShellInSandbox } from './fileSystem';
import { useStore } from './store';

// Track recently checked files to avoid spamming notifications
const recentlyCheckedFiles = new Map<string, number>();
const CHECK_COOLDOWN = 30000; // 30 seconds
// Track packages we've already notified about to avoid duplicate toasts
const notifiedPackages = new Set<string>();

/**
 * Check for missing dependencies and show toast notification
 */
export async function checkAndNotifyMissingDependencies(filePath: string, content: string) {
  // Skip if not a code file
  if (!shouldCheckFile(filePath)) {
    return;
  }

  // Skip if no project is loaded
  if (!useStore.getState().hasProject) {
    return;
  }

  // Skip if we recently checked this file
  const lastCheck = recentlyCheckedFiles.get(filePath);
  const now = Date.now();
  if (lastCheck && now - lastCheck < CHECK_COOLDOWN) {
    return;
  }

  recentlyCheckedFiles.set(filePath, now);

  try {
    const missingDeps = await detectMissingDependencies(content);
    // Filter out packages we've already notified about
    const newMissing = missingDeps.filter(dep => !notifiedPackages.has(dep));

    if (newMissing.length > 0) {
      for (const dep of newMissing) {
        notifiedPackages.add(dep);
      }

      const depList = newMissing.join(', ');
      const message = newMissing.length === 1
        ? `Missing dependency: ${depList}`
        : `Missing dependencies: ${depList}`;

      toast(message, {
        duration: 10000,
        action: {
          label: 'Install',
          onClick: async () => {
            await installDependencies(newMissing);
          },
        },
      });
    }
  } catch {
    // Silently fail — dependency detection is best-effort
  }
}

/**
 * Install missing dependencies
 */
async function installDependencies(packages: string[]) {
  // Re-validate all package names before passing to shell
  const safePackages = packages.filter(isValidPackageName);
  if (safePackages.length === 0) return;

  const { previewUrl, sandboxStatus } = useStore.getState();
  const isRunning = previewUrl !== null && sandboxStatus === 'ready';

  try {
    toast.loading(`Installing ${safePackages.join(', ')}...`, { id: 'install-deps' });

    if (isRunning) {
      const { stopDevServer } = await import('./fileSystem');
      await stopDevServer();
    }

    const installCommand = `npm install ${safePackages.join(' ')}`;
    const exitCode = await runShellInSandbox(installCommand, 180000);

    if (exitCode === 0) {
      toast.success(`Installed ${safePackages.join(', ')}`, { id: 'install-deps' });
      // Clear from notified set so they won't be flagged again
      for (const pkg of safePackages) {
        notifiedPackages.delete(pkg);
      }

      toast.loading('Starting dev server...', { id: 'install-deps' });
      // Clear previewUrl so the WorkspacePanel effect re-fires on the new URL
      useStore.getState().setPreviewUrl(null);
      try {
        const { startDevServerInSandbox } = await import('./fileSystem');
        await startDevServerInSandbox();
        toast.success('Dev server started', { id: 'install-deps' });
      } catch {
        toast.error('Installed packages but failed to start dev server', { id: 'install-deps' });
      }
    } else {
      toast.error('Failed to install dependencies. Check terminal for details.', { id: 'install-deps' });
    }
  } catch (error) {
    console.error('Failed to install dependencies:', error);
    toast.error('Failed to install dependencies', { id: 'install-deps' });
  }
}

/**
 * Clear the cooldown and notification caches
 */
export function clearDependencyCheckCache() {
  recentlyCheckedFiles.clear();
  notifiedPackages.clear();
}
