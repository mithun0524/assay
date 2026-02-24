'use client';

import { useState } from 'react';
import { RiDeleteBinLine, RiShutDownLine, RiRestartLine, RiLoader4Line, RiPlayLine, RiNpmjsLine, RiDownloadLine } from '@remixicon/react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';
import { stopDevServer, runShellInSandbox, startDevServerInSandbox } from '@/lib/fileSystem';
import { downloadTerminalOutput } from '@/lib/downloadTerminal';
import { Tooltip } from './Tooltip';

export function TerminalToolbar() {
  const { sandboxStatus, previewUrl, isStreaming, terminalOutput, clearTerminal } = useStore();
  const { submit } = useChat();

  const [isStarting, setIsStarting] = useState(false);
  const [isKillingProcess, setIsKillingProcess] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isRunningNpmInstall, setIsRunningNpmInstall] = useState(false);

  const isServerRunning = previewUrl !== null && sandboxStatus === 'ready';
  const isAnyOperationInProgress = isStarting || isKillingProcess || isRestarting || isRunningNpmInstall || sandboxStatus === 'installing';

  // Clear terminal button
  const handleClearTerminal = () => {
    clearTerminal();
  };

  // Download terminal output button
  const handleDownloadTerminal = () => {
    if (!terminalOutput || terminalOutput.trim().length === 0) {
      toast.error('Terminal is empty - nothing to download');
      return;
    }

    try {
      downloadTerminalOutput(terminalOutput);
      toast.success('Terminal output downloaded');
    } catch (error) {
      console.error('Failed to download terminal output:', error);
      toast.error('Failed to download terminal output');
    }
  };

  // Start dev server button
  const handleStartDevServer = async () => {
    if (isServerRunning || isAnyOperationInProgress || sandboxStatus === 'starting') return;

    setIsStarting(true);
    try {
      useStore.getState().setPreviewUrl(null);
      await startDevServerInSandbox();
      toast.success('Dev server started');
    } catch (error) {
      console.error('Failed to start dev server:', error);
      toast.error('Failed to start dev server');
    } finally {
      setIsStarting(false);
    }
  };

  // Kill process button
  const handleKillProcess = async () => {
    if (!isServerRunning || isAnyOperationInProgress) return;

    setIsKillingProcess(true);
    try {
      await stopDevServer();
      toast.success('Process killed');
    } catch (error) {
      console.error('Failed to kill process:', error);
      toast.error('Failed to kill process');
    } finally {
      setIsKillingProcess(false);
    }
  };

  // Restart dev server button
  const handleRestartDevServer = async () => {
    if (!isServerRunning || isAnyOperationInProgress) return;

    setIsRestarting(true);
    try {
      await stopDevServer();
      useStore.getState().setPreviewUrl(null);
      await startDevServerInSandbox();
      toast.success('Dev server restarted');
    } catch (error) {
      console.error('Failed to restart dev server:', error);
      toast.error('Failed to restart dev server');
    } finally {
      setIsRestarting(false);
    }
  };

  // Smart npm install button
  const handleSmartNpmInstall = async () => {
    if (isAnyOperationInProgress || isStreaming) return;

    setIsRunningNpmInstall(true);
    const wasRunning = previewUrl !== null && sandboxStatus === 'ready';

    try {
      // Step 1: Stop dev server if running
      if (wasRunning) {
        await stopDevServer();
      }

      // Step 2: Run npm install with 5-minute timeout
      const exitCode = await runShellInSandbox('npm install', 300000);

      // Step 3: Check exit code and handle success/failure
      if (exitCode === 0) {
        toast.success('Dependencies installed successfully');

        // Step 4: Always start dev server after successful install
        useStore.getState().setPreviewUrl(null);
        try {
          await startDevServerInSandbox();
          toast.success('Dev server started');
        } catch {
          toast.error('Installed but failed to start dev server');
        }
      } else {
        // FAILURE - Restart server if it was running, then delegate error to AI
        if (wasRunning) {
          try {
            await startDevServerInSandbox();
          } catch { /* best effort */ }
        }

        const output = useStore.getState().terminalOutput;
        const lines = output.split('\n');
        const lastLines = lines.slice(-20).join('\n');
        const errorText = lastLines.trim() || 'npm install failed with unknown error';

        toast.error('npm install failed - delegating to AI');
        submit(`npm install failed with the following errors. Please help fix them:\n\n\`\`\`\n${errorText}\n\`\`\``);
      }
    } catch (error) {
      console.error('npm install error:', error);
      toast.error('npm install encountered an error');
    } finally {
      setIsRunningNpmInstall(false);
    }
  };

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.06] bg-[#09090b]">
      {/* Clear Terminal Button */}
      <Tooltip content="Clear terminal" side="bottom">
        <button
          onClick={handleClearTerminal}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all"
        >
          <RiDeleteBinLine className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
        </button>
      </Tooltip>

      {/* Download Terminal Output Button */}
      <Tooltip content="Download terminal output" side="bottom">
        <button
          onClick={handleDownloadTerminal}
          disabled={!terminalOutput || terminalOutput.trim().length === 0}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RiDownloadLine className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
        </button>
      </Tooltip>

      {/* Visual divider */}
      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Start Dev Server Button */}
      <Tooltip content="Start dev server" side="bottom">
        <button
          onClick={handleStartDevServer}
          disabled={isServerRunning || isAnyOperationInProgress}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isStarting ? (
            <RiLoader4Line className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
          ) : (
            <RiPlayLine className="w-3.5 h-3.5 text-emerald-400" />
          )}
        </button>
      </Tooltip>

      {/* Kill Process Button */}
      <Tooltip content="Kill process" side="bottom">
        <button
          onClick={handleKillProcess}
          disabled={!isServerRunning || isAnyOperationInProgress}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isKillingProcess ? (
            <RiLoader4Line className="w-3.5 h-3.5 text-red-400 animate-spin" />
          ) : (
            <RiShutDownLine className="w-3.5 h-3.5 text-red-400" />
          )}
        </button>
      </Tooltip>

      {/* Restart Dev Server Button */}
      <Tooltip content="Restart dev server" side="bottom">
        <button
          onClick={handleRestartDevServer}
          disabled={!isServerRunning || isAnyOperationInProgress}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isRestarting ? (
            <RiLoader4Line className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
          ) : (
            <RiRestartLine className="w-3.5 h-3.5 text-zinc-400" />
          )}
        </button>
      </Tooltip>

      {/* Visual divider */}
      <div className="w-px h-4 bg-white/[0.06] mx-1" />

      {/* Smart npm Install Button */}
      <Tooltip content="Smart npm install (auto-restart)" side="bottom">
        <button
          onClick={handleSmartNpmInstall}
          disabled={isAnyOperationInProgress || isStreaming}
          className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isRunningNpmInstall ? (
            <RiLoader4Line className="w-3.5 h-3.5 text-amber-400 animate-spin" />
          ) : (
            <RiNpmjsLine className="w-3.5 h-3.5 text-amber-400" />
          )}
        </button>
      </Tooltip>

      {/* Status badge during operations */}
      {isRunningNpmInstall && (
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 text-[10px] text-amber-300/80 bg-amber-500/10 rounded-md border border-amber-500/20">
          <RiLoader4Line className="w-3 h-3 animate-spin" />
          Installing...
        </div>
      )}
    </div>
  );
}
