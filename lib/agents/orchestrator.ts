/**
 * Orchestration decisions for one agent turn.
 *
 * Pure functions on purpose: the "what do we do with what the model emitted"
 * logic used to live inline in the chat hook, where it could only be tested by
 * running a real model against a real WebContainer.
 */

import type { QaIssue } from '../qaGate';

/** Long-running commands that never exit — they mean "start the dev server". */
export const DEV_SERVER_RE = /^(npm\s+(run\s+)?(dev|start)|yarn\s+(dev|start)|pnpm\s+(run\s+)?(dev|start)|npx\s+vite|vite)\b/;
export const INSTALL_CMD_RE = /^(npm\s+(install|i|ci)\b|yarn(\s+install)?\b|pnpm\s+(install|i)\b|bun\s+(install|i)\b)/;

export type ExecutionPlan = {
  /** Kill the running dev server before touching dependencies (like Ctrl+C). */
  stopServerFirst: boolean;
  /** Commands to actually run, in order — dev-server commands removed. */
  shellCommands: string[];
  /** An install command is part of this batch. */
  hasInstallCommand: boolean;
  /** Run installDependencies() ourselves before starting the server. */
  runInstall: boolean;
  /** Start (or restart) the dev server after the commands. */
  startServer: boolean;
  /** Nothing will start a server — clear any transitional status. */
  resetStatusToIdle: boolean;
};

export function planExecution(input: {
  shells: string[];
  start: string | null;
  wroteFiles: boolean;
  serverWasRunning: boolean;
  /** The project has a package.json with a dev/start script. */
  hasRunnableProject?: boolean;
}): ExecutionPlan {
  const shells = input.shells.map((c) => c.trim()).filter(Boolean);

  const devServerCommands = shells.filter((c) => DEV_SERVER_RE.test(c));
  const shellCommands = shells.filter((c) => !DEV_SERVER_RE.test(c));
  const hasInstallCommand = shells.some((c) => INSTALL_CMD_RE.test(c));

  // A restart is implied when we disturbed a server that was already running.
  const startServer =
    input.start !== null ||
    devServerCommands.length > 0 ||
    (shells.length > 0 && input.serverWasRunning) ||
    // Measured: some models write a complete project and never emit a start
    // action, leaving the preview blank. Start it ourselves rather than burning
    // a QA round trip on it.
    (input.wroteFiles && input.hasRunnableProject === true && !input.serverWasRunning);

  return {
    stopServerFirst: shells.length > 0 && input.serverWasRunning,
    shellCommands,
    hasInstallCommand,
    // Dependencies must exist before the server boots; skip if the model
    // already installed them, or if it never wrote a project to install.
    runInstall: startServer && !hasInstallCommand && input.wroteFiles,
    startServer,
    resetStatusToIdle: !startServer,
  };
}

export type QaDecision =
  | { action: 'fix'; attempt: number }
  | { action: 'pass' }
  | { action: 'give-up'; attempt: number };

/**
 * What to do with the QA gate's findings. `attemptsUsed` is how many auto-fix
 * rounds have already run for this user request.
 */
export function decideAfterQa(
  issues: QaIssue[],
  attemptsUsed: number,
  maxAttempts: number
): QaDecision {
  if (issues.length === 0) return { action: 'pass' };
  if (attemptsUsed >= maxAttempts) return { action: 'give-up', attempt: attemptsUsed };
  return { action: 'fix', attempt: attemptsUsed + 1 };
}

/** A turn is only worth QA-ing if it actually changed the running app. */
export function shouldRunQa(input: {
  wroteFiles: boolean;
  shells: string[];
  start: string | null;
  awaitingReview: boolean;
}): boolean {
  if (input.awaitingReview) return false;
  return input.wroteFiles || input.shells.length > 0 || input.start !== null;
}
