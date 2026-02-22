'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RiArrowRightSLine, RiFolderOpenLine, RiFolderLine, RiFileTextLine, RiFileCodeLine, RiFileSettingsLine } from '@remixicon/react';
import { File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { writeFileToSandbox } from '@/lib/fileSystem';
import { getWebContainer } from '@/lib/webcontainer';
import type { TreeNode } from '@/lib/utils';

interface FileTreeProps {
  tree: TreeNode[];
}

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <RiFileCodeLine className="w-4 h-4 text-blue-400" />;
    case 'js':
    case 'jsx':
      return <RiFileCodeLine className="w-4 h-4 text-yellow-400" />;
    case 'json':
      return <RiFileSettingsLine className="w-4 h-4 text-amber-400" />;
    case 'css':
      return <RiFileTextLine className="w-4 h-4 text-purple-400" />;
    case 'html':
      return <RiFileTextLine className="w-4 h-4 text-orange-400" />;
    default:
      return <RiFileTextLine className="w-4 h-4 text-zinc-500" />;
  }
}

/** Collect all directory paths from a tree. */
function collectDirPaths(nodes: TreeNode[], result: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.type === 'directory') {
      result.add(node.path);
      if (node.children) collectDirPaths(node.children, result);
    }
  }
  return result;
}

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

function TreeNodeComponent({
  node,
  depth = 0,
  expanded,
  onToggle,
  onContextMenu,
  renaming,
  creating,
  onRenameSubmit,
  onRenameCancel,
  onCreateSubmit,
  onCreateCancel,
}: {
  node: TreeNode;
  depth?: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renaming: string | null;
  creating: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  onCreateSubmit: (dirPath: string, name: string) => void;
  onCreateCancel: () => void;
}) {
  const { openTab, setActiveFile, activeFile, activelyWritingFile } = useStore();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expanded.has(node.path);
  const isActive = activeFile === node.path;
  const isWriting = activelyWritingFile === node.path;
  const isRenaming = renaming === node.path;

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      const name = node.name;
      const dotIndex = name.lastIndexOf('.');
      renameInputRef.current.setSelectionRange(0, dotIndex > 0 ? dotIndex : name.length);
    }
  }, [isRenaming, node.name]);

  useEffect(() => {
    if (creating === node.path && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creating, node.path]);

  const handleClick = () => {
    if (isRenaming) return;
    if (node.type === 'directory') {
      onToggle(node.path);
    } else {
      openTab(node.path);
      setActiveFile(node.path);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const newName = (e.target as HTMLInputElement).value.trim();
      if (newName && newName !== node.name) {
        onRenameSubmit(node.path, newName);
      } else {
        onRenameCancel();
      }
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const name = (e.target as HTMLInputElement).value.trim();
      if (name) {
        onCreateSubmit(node.path, name);
      } else {
        onCreateCancel();
      }
    } else if (e.key === 'Escape') {
      onCreateCancel();
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md text-sm transition-all duration-150',
          isActive
            ? 'bg-violet-500/10 text-zinc-200 border-l-2 border-violet-500 ml-0'
            : 'hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-l-2 border-transparent hover:translate-x-0.5',
          isWriting && 'writing-pulse'
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        {node.type === 'directory' ? (
          <>
            <RiArrowRightSLine className={cn(
              'w-3 h-3 text-zinc-600 transition-transform duration-200',
              isExpanded && 'rotate-90'
            )} />
            {isExpanded ? (
              <RiFolderOpenLine className="w-4 h-4 text-zinc-400" />
            ) : (
              <RiFolderLine className="w-4 h-4 text-zinc-500" />
            )}
          </>
        ) : (
          <>
            {isWriting && (
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
            )}
            {getFileIcon(node.name)}
          </>
        )}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            defaultValue={node.name}
            onKeyDown={handleRenameKeyDown}
            onBlur={onRenameCancel}
            className="flex-1 bg-white/[0.06] border border-violet-500/40 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>

      {/* Creating new file inline input */}
      {node.type === 'directory' && creating === node.path && (
        <div className="flex items-center gap-1.5 px-2 py-1" style={{ paddingLeft: (depth + 1) * 12 + 8 }}>
          <File className="w-4 h-4 text-zinc-500" />
          <input
            ref={createInputRef}
            placeholder="filename..."
            onKeyDown={handleCreateKeyDown}
            onBlur={onCreateCancel}
            className="flex-1 bg-white/[0.06] border border-violet-500/40 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none min-w-0"
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        {node.type === 'directory' && isExpanded && node.children && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onContextMenu={onContextMenu}
                renaming={renaming}
                creating={creating}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                onCreateSubmit={onCreateSubmit}
                onCreateCancel={onCreateCancel}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FileTree({ tree }: FileTreeProps) {
  const { files, deleteFile, closeTab } = useStore();

  // Auto-expand: all directories start expanded
  const allDirs = useMemo(() => collectDirPaths(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const knownDirsRef = useRef<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  // Only auto-expand genuinely NEW directories (not ones the user collapsed)
  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const dir of allDirs) {
        if (!knownDirsRef.current.has(dir)) {
          next.add(dir);
          changed = true;
        }
      }
      knownDirsRef.current = new Set(allDirs);
      return changed ? next : prev;
    });
  }, [allDirs]);

  const handleToggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  // Close context menu
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  const handleDelete = async (path: string) => {
    deleteFile(path);
    closeTab(path);
    try {
      const wc = await getWebContainer();
      await wc.fs.rm(path, { recursive: true });
    } catch {
      // ignore if file doesn't exist
    }
  };

  const handleRenameSubmit = async (oldPath: string, newName: string) => {
    const parts = oldPath.split('/');
    parts[parts.length - 1] = newName;
    const newPath = parts.join('/');

    const entry = files[oldPath];
    if (entry) {
      deleteFile(oldPath);
      closeTab(oldPath);
      await writeFileToSandbox(newPath, entry.content);
      try {
        const wc = await getWebContainer();
        await wc.fs.rm(oldPath);
      } catch {
        // ignore
      }
    }
    setRenaming(null);
  };

  const handleCreateSubmit = async (dirPath: string, name: string) => {
    const filePath = dirPath + '/' + name;
    await writeFileToSandbox(filePath, '');
    setCreating(null);
  };

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
          <RiFolderLine className="w-5 h-5 text-zinc-600" />
        </div>
        <p className="text-xs font-medium text-zinc-500 mb-1">No files yet</p>
        <p className="text-[11px] text-zinc-600">Files will appear here as they&apos;re created</p>
      </div>
    );
  }

  return (
    <div className="py-2 space-y-0.5">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          expanded={expanded}
          onToggle={handleToggle}
          onContextMenu={handleContextMenu}
          renaming={renaming}
          creating={creating}
          onRenameSubmit={handleRenameSubmit}
          onRenameCancel={() => setRenaming(null)}
          onCreateSubmit={handleCreateSubmit}
          onCreateCancel={() => setCreating(null)}
        />
      ))}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#18181b] border border-white/[0.1] shadow-xl rounded-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'directory' && (
            <button
              onClick={() => {
                // Ensure directory is expanded so the input is visible
                setExpanded(prev => {
                  const next = new Set(prev);
                  next.add(contextMenu.node.path);
                  return next;
                });
                setCreating(contextMenu.node.path);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors"
            >
              New File
            </button>
          )}
          <button
            onClick={() => { setRenaming(contextMenu.node.path); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors"
          >
            Rename
          </button>
          <button
            onClick={() => { handleDelete(contextMenu.node.path); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 text-left transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
