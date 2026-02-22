'use client';

import { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useStore, PendingChange } from '@/lib/store';
import { RiCheckLine, RiCloseLine, RiCheckboxCircleLine, RiCloseCircleLine, RiFileTextLine, RiFileAddLine, RiFileEditLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { getDiffStats, formatDiffStats, getFileOperation } from '@/lib/diffUtils';

export function DiffViewer() {
  const {
    pendingChanges,
    acceptChange,
    rejectChange,
    acceptAllChanges,
    rejectAllChanges,
    clearPendingChanges,
    applyAcceptedChanges,
  } = useStore();

  const [selectedFile, setSelectedFile] = useState<string>(
    pendingChanges[0]?.filePath || ''
  );
  const [applying, setApplying] = useState(false);

  const selectedChange = pendingChanges.find((c) => c.filePath === selectedFile);

  const handleApply = async () => {
    setApplying(true);
    try {
      await applyAcceptedChanges();
    } catch (error) {
      console.error('Failed to apply changes:', error);
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    rejectAllChanges();
    clearPendingChanges();
  };

  const acceptedCount = pendingChanges.filter((c) => c.status === 'accepted').length;
  const rejectedCount = pendingChanges.filter((c) => c.status === 'rejected').length;

  if (!selectedChange) {
    return null;
  }

  const operation = getFileOperation(selectedChange.oldContent, selectedChange.newContent);
  const stats =
    selectedChange.oldContent !== null
      ? getDiffStats(selectedChange.oldContent, selectedChange.newContent)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex bg-black/70 backdrop-blur-sm">
      {/* Sidebar */}
      <div className="w-80 border-r border-white/[0.06] bg-zinc-900 flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-zinc-100 mb-1">Review Changes</h2>
          <p className="text-xs text-zinc-400">
            {pendingChanges.length} file{pendingChanges.length !== 1 ? 's' : ''} modified
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {pendingChanges.map((change) => {
            const op = getFileOperation(change.oldContent, change.newContent);
            const Icon = op === 'create' ? RiFileAddLine : op === 'modify' ? RiFileEditLine : RiFileTextLine;
            const changeStats =
              change.oldContent !== null
                ? getDiffStats(change.oldContent, change.newContent)
                : null;

            return (
              <button
                key={change.filePath}
                onClick={() => setSelectedFile(change.filePath)}
                className={cn(
                  'w-full p-3 mb-1 rounded-lg text-left transition-all',
                  'border border-white/[0.06]',
                  selectedFile === change.filePath
                    ? 'bg-zinc-800 border-violet-500/50'
                    : 'hover:bg-zinc-800/50'
                )}
              >
                <div className="flex items-start gap-2 mb-1">
                  <Icon
                    size={16}
                    className={cn(
                      'flex-shrink-0 mt-0.5',
                      op === 'create' ? 'text-green-400' : 'text-blue-400'
                    )}
                  />
                  <span className="text-xs text-zinc-200 font-medium break-all">
                    {change.filePath}
                  </span>
                </div>
                {changeStats && (
                  <div className="text-xs text-zinc-500 ml-6">
                    {formatDiffStats(changeStats)}
                  </div>
                )}
                <div className="ml-6 mt-1">
                  {change.status === 'accepted' && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                      <RiCheckboxCircleLine size={12} />
                      Accepted
                    </span>
                  )}
                  {change.status === 'rejected' && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400">
                      <RiCloseCircleLine size={12} />
                      Rejected
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/[0.06] space-y-2">
          <div className="flex gap-2">
            <button
              onClick={acceptAllChanges}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
            >
              <RiCheckboxCircleLine size={14} />
              Accept All
            </button>
            <button
              onClick={rejectAllChanges}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              <RiCloseCircleLine size={14} />
              Reject All
            </button>
          </div>

          <button
            onClick={handleApply}
            disabled={applying || acceptedCount === 0}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              acceptedCount > 0
                ? 'btn-premium'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            )}
          >
            {applying ? (
              'Applying...'
            ) : (
              <>
                Apply {acceptedCount} Change{acceptedCount !== 1 ? 's' : ''}
              </>
            )}
          </button>

          <button
            onClick={handleClose}
            className="w-full px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-zinc-100">
                {selectedChange.filePath}
              </span>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  operation === 'create' && 'bg-green-500/10 text-green-400',
                  operation === 'modify' && 'bg-blue-500/10 text-blue-400'
                )}
              >
                {operation}
              </span>
            </div>
            {stats && (
              <div className="text-xs text-zinc-400">{formatDiffStats(stats)}</div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => acceptChange(selectedChange.filePath)}
              disabled={selectedChange.status === 'accepted'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                selectedChange.status === 'accepted'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-green-500/10 hover:text-green-400'
              )}
            >
              <RiCheckLine size={14} />
              Accept
            </button>
            <button
              onClick={() => rejectChange(selectedChange.filePath)}
              disabled={selectedChange.status === 'rejected'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                selectedChange.status === 'rejected'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-red-500/10 hover:text-red-400'
              )}
            >
              <RiCloseLine size={14} />
              Reject
            </button>
          </div>
        </div>

        {/* Diff content */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <ReactDiffViewer
            oldValue={selectedChange.oldContent || ''}
            newValue={selectedChange.newContent}
            splitView={true}
            compareMethod={DiffMethod.WORDS}
            useDarkTheme={true}
            styles={{
              variables: {
                dark: {
                  diffViewerBackground: '#0a0a0a',
                  diffViewerColor: '#e4e4e7',
                  addedBackground: '#052e16',
                  addedColor: '#bbf7d0',
                  removedBackground: '#450a0a',
                  removedColor: '#fca5a5',
                  wordAddedBackground: '#166534',
                  wordRemovedBackground: '#991b1b',
                  addedGutterBackground: '#14532d',
                  removedGutterBackground: '#7f1d1d',
                  gutterBackground: '#18181b',
                  gutterBackgroundDark: '#09090b',
                  highlightBackground: '#27272a',
                  highlightGutterBackground: '#18181b',
                },
              },
              line: {
                fontSize: '13px',
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                padding: '0 10px',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
