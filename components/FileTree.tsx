'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RiArrowRightSLine, RiFolderOpenLine, RiFolderLine, RiFileTextLine, RiFileCodeLine, RiFileSettingsLine } from '@remixicon/react';
import { File, Search, X, FolderPlus } from 'lucide-react';
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
      return <RiFileTextLine className="w-4 h-4 text-zinc-400" />;
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

/** Filter tree nodes based on search query */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;

  const lowerQuery = query.toLowerCase();
  const filtered: TreeNode[] = [];

  for (const node of nodes) {
    if (node.type === 'file') {
      if (node.name.toLowerCase().includes(lowerQuery)) {
        filtered.push(node);
      }
    } else {
      const filteredChildren = node.children ? filterTree(node.children, query) : [];

      if (filteredChildren.length > 0) {
        // Directory has matching descendants — show it with only those descendants
        filtered.push({ ...node, children: filteredChildren });
      } else if (node.name.toLowerCase().includes(lowerQuery)) {
        // Directory name itself matches — show it with all its children
        filtered.push(node);
      }
    }
  }

  return filtered;
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
  creatingFolder,
  onRenameSubmit,
  onRenameCancel,
  onCreateSubmit,
  onCreateCancel,
  onCreateFolderSubmit,
  onCreateFolderCancel,
  onDrop,
  dragOverPath,
  onDragOver,
  onDragLeave,
}: {
  node: TreeNode;
  depth?: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  renaming: string | null;
  creating: string | null;
  creatingFolder: string | null;
  onRenameSubmit: (oldPath: string, newName: string) => void;
  onRenameCancel: () => void;
  onCreateSubmit: (dirPath: string, name: string) => void;
  onCreateCancel: () => void;
  onCreateFolderSubmit: (parentPath: string, name: string) => void;
  onCreateFolderCancel: () => void;
  onDrop: (sourcePath: string, targetDirPath: string) => void;
  dragOverPath: string | null;
  onDragOver: (path: string) => void;
  onDragLeave: () => void;
}) {
  const { openTab, setActiveFile, activeFile, activelyWritingFile } = useStore();
  const renameInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const createFolderInputRef = useRef<HTMLInputElement>(null);

  const isExpanded = expanded.has(node.path);
  const isActive = activeFile === node.path;
  const isWriting = activelyWritingFile === node.path;
  const isRenaming = renaming === node.path;
  const isDragTarget = dragOverPath === node.path && node.type === 'directory';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (node.type === 'directory') {
      onDragOver(node.path);
    }
  };

  const handleDragLeaveEvt = (e: React.DragEvent) => {
    e.preventDefault();
    onDragLeave();
  };

  const handleDropEvt = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragLeave();
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath || sourcePath === node.path) return;
    // Determine target directory
    const targetDir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/');
    if (targetDir && sourcePath !== targetDir && !targetDir.startsWith(sourcePath + '/')) {
      onDrop(sourcePath, targetDir);
    }
  };

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

  useEffect(() => {
    if (creatingFolder === node.path && createFolderInputRef.current) {
      createFolderInputRef.current.focus();
    }
  }, [creatingFolder, node.path]);

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

  const handleCreateFolderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const name = (e.target as HTMLInputElement).value.trim();
      if (name) {
        onCreateFolderSubmit(node.path, name);
      } else {
        onCreateFolderCancel();
      }
    } else if (e.key === 'Escape') {
      onCreateFolderCancel();
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md text-sm transition-all duration-150',
          isActive
            ? 'bg-white/[0.06] text-zinc-200 border-l-2 border-white/40 ml-0'
            : 'hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-l-2 border-transparent hover:translate-x-0.5',
          isWriting && 'writing-pulse',
          isDragTarget && 'bg-white/[0.1] border-l-2 border-white/60'
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        draggable={!isRenaming}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeaveEvt}
        onDrop={handleDropEvt}
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
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse shrink-0" />
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
            className="flex-1 bg-white/[0.06] border border-white/45 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none min-w-0"
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
            className="flex-1 bg-white/[0.06] border border-white/45 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none min-w-0"
          />
        </div>
      )}

      {/* Creating new folder inline input */}
      {node.type === 'directory' && creatingFolder === node.path && (
        <div className="flex items-center gap-1.5 px-2 py-1" style={{ paddingLeft: (depth + 1) * 12 + 8 }}>
          <RiFolderLine className="w-4 h-4 text-zinc-500" />
          <input
            ref={createFolderInputRef}
            placeholder="folder name..."
            onKeyDown={handleCreateFolderKeyDown}
            onBlur={onCreateFolderCancel}
            className="flex-1 bg-white/[0.06] border border-white/45 rounded px-1 py-0.5 text-xs text-zinc-200 focus:outline-none min-w-0"
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
                creatingFolder={creatingFolder}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                onCreateSubmit={onCreateSubmit}
                onCreateCancel={onCreateCancel}
                onCreateFolderSubmit={onCreateFolderSubmit}
                onCreateFolderCancel={onCreateFolderCancel}
                onDrop={onDrop}
                dragOverPath={dragOverPath}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
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

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter tree based on search query
  const filteredTree = useMemo(() => filterTree(tree, searchQuery), [tree, searchQuery]);

  // Auto-expand: all directories start expanded
  const allDirs = useMemo(() => collectDirPaths(searchQuery ? filteredTree : tree), [filteredTree, tree, searchQuery]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const knownDirsRef = useRef<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
  const preSearchExpandedRef = useRef<Set<string> | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const handleDrop = useCallback(async (sourcePath: string, targetDirPath: string) => {
    const fileName = sourcePath.split('/').pop()!;
    const newPath = targetDirPath + '/' + fileName;

    // Don't drop onto itself
    if (sourcePath === newPath) return;

    const entry = files[sourcePath];
    if (entry) {
      // Moving a file
      deleteFile(sourcePath);
      closeTab(sourcePath);
      await writeFileToSandbox(newPath, entry.content);
      try {
        const wc = await getWebContainer();
        await wc.fs.rm(sourcePath);
      } catch { /* ignore */ }
    } else {
      // Moving a directory — move all children
      const allPaths = Object.keys(files);
      const childPaths = allPaths.filter(p => p === sourcePath || p.startsWith(sourcePath + '/'));
      for (const childOldPath of childPaths) {
        const childNewPath = targetDirPath + '/' + fileName + childOldPath.slice(sourcePath.length);
        const childEntry = files[childOldPath];
        if (childEntry) {
          deleteFile(childOldPath);
          closeTab(childOldPath);
          await writeFileToSandbox(childNewPath, childEntry.content);
        }
      }
      try {
        const wc = await getWebContainer();
        await wc.fs.rm(sourcePath, { recursive: true });
      } catch { /* ignore */ }
    }

    // Expand target directory
    setExpanded(prev => {
      const next = new Set(prev);
      next.add(targetDirPath);
      return next;
    });
  }, [files, deleteFile, closeTab]);

  // Only auto-expand genuinely NEW directories (not ones the user collapsed)
  useEffect(() => {
    if (searchQuery) return; // Don't run normal auto-expand logic while searching
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
  }, [allDirs, searchQuery]);

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
    // Remove from store — if it's a directory, also remove all children
    const allPaths = Object.keys(files);
    const childPaths = allPaths.filter(p => p.startsWith(path + '/'));
    for (const child of childPaths) {
      deleteFile(child);
      closeTab(child);
    }
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
      // Renaming a file
      deleteFile(oldPath);
      closeTab(oldPath);
      await writeFileToSandbox(newPath, entry.content);
      try {
        const wc = await getWebContainer();
        await wc.fs.rm(oldPath);
      } catch {
        // ignore
      }
    } else {
      // Renaming a directory — move all children
      const allPaths = Object.keys(files);
      const childPaths = allPaths.filter(p => p.startsWith(oldPath + '/'));
      for (const childOldPath of childPaths) {
        const childNewPath = newPath + childOldPath.slice(oldPath.length);
        const childEntry = files[childOldPath];
        if (childEntry) {
          deleteFile(childOldPath);
          closeTab(childOldPath);
          await writeFileToSandbox(childNewPath, childEntry.content);
        }
      }
      try {
        const wc = await getWebContainer();
        await wc.fs.rm(oldPath, { recursive: true });
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

  const handleCreateFolderSubmit = async (parentPath: string, name: string) => {
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      const wc = await getWebContainer();
      await wc.fs.mkdir(folderPath, { recursive: true });
      // The file tree is built from the files store (file-based). Empty folders
      // can't be shown. Create a minimal placeholder so the directory appears,
      // then immediately open the "new file" input so the user can add a real
      // first file. The placeholder is removed once a real file is created.
      const placeholderPath = `${folderPath}/.gitkeep`;
      await wc.fs.writeFile(placeholderPath, '');
      useStore.getState().setFile(placeholderPath, { content: '', language: 'plaintext' });
      // Expand the new folder and prompt for the first file
      setExpanded(prev => {
        const next = new Set(prev);
        next.add(folderPath);
        return next;
      });
      setCreating(folderPath);
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
    setCreatingFolder(null);
  };

  // Auto-expand all directories when searching; restore on clear
  useEffect(() => {
    if (searchQuery) {
      // Save expanded state before search overrides it
      if (!preSearchExpandedRef.current) {
        preSearchExpandedRef.current = new Set(expanded);
      }
      setExpanded(new Set(collectDirPaths(filteredTree)));
    } else if (preSearchExpandedRef.current) {
      // Restore pre-search state when search is cleared
      setExpanded(preSearchExpandedRef.current);
      preSearchExpandedRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filteredTree]);

  // Show empty state
  if (tree.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-2 py-2 border-b border-white/[0.06]">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              disabled
              className={cn(
                'w-full pl-7 pr-7 py-1.5 rounded-lg text-xs text-zinc-200',
                'bg-white/[0.04] border border-white/[0.06]',
                'placeholder:text-zinc-600',
                'opacity-50 cursor-not-allowed'
              )}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
            <RiFolderLine className="w-5 h-5 text-zinc-600" />
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">No files yet</p>
          <p className="text-[11px] text-zinc-600">Files will appear here as they&apos;re created</p>
        </div>
      </div>
    );
  }

  // Show no results state when searching
  const noResults = searchQuery && filteredTree.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="px-2 py-2 border-b border-white/[0.06]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className={cn(
              'w-full pl-7 pr-7 py-1.5 rounded-lg text-xs text-zinc-200',
              'bg-white/[0.04] border border-white/[0.06]',
              'focus:outline-none focus:border-white/45',
              'placeholder:text-zinc-600',
              'transition-all'
            )}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/[0.06] rounded transition-all"
            >
              <X className="w-3 h-3 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {noResults ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
              <Search className="w-5 h-5 text-zinc-600" />
            </div>
            <p className="text-xs font-medium text-zinc-500 mb-1">No results found</p>
            <p className="text-[11px] text-zinc-600">Try a different search term</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <TreeNodeComponent
                key={node.path}
                node={node}
                expanded={expanded}
                onToggle={handleToggle}
                onContextMenu={handleContextMenu}
                renaming={renaming}
                creating={creating}
                creatingFolder={creatingFolder}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={() => setRenaming(null)}
                onCreateSubmit={handleCreateSubmit}
                onCreateCancel={() => setCreating(null)}
                onCreateFolderSubmit={handleCreateFolderSubmit}
                onCreateFolderCancel={() => setCreatingFolder(null)}
                onDrop={handleDrop}
                dragOverPath={dragOverPath}
                onDragOver={setDragOverPath}
                onDragLeave={() => setDragOverPath(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#18181b] border border-white/[0.1] shadow-xl rounded-xl py-1 z-50 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.type === 'directory' && (
            <>
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
                className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors flex items-center gap-2"
              >
                <File className="w-3 h-3" />
                New File
              </button>
              <button
                onClick={() => {
                  // Ensure directory is expanded so the input is visible
                  setExpanded(prev => {
                    const next = new Set(prev);
                    next.add(contextMenu.node.path);
                    return next;
                  });
                  setCreatingFolder(contextMenu.node.path);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors flex items-center gap-2"
              >
                <FolderPlus className="w-3 h-3" />
                New Folder
              </button>
              <div className="h-px bg-white/[0.06] my-1" />
            </>
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
