'use client';

import { useState, useEffect, useMemo } from 'react';
import { RiArrowRightSLine, RiFolderOpenLine, RiFolderLine, RiFileTextLine, RiFileCodeLine, RiFileSettingsLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';
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

function TreeNodeComponent({
  node,
  depth = 0,
  expanded,
  onToggle,
}: {
  node: TreeNode;
  depth?: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const { openTab, setActiveFile, activeFile, activelyWritingFile } = useStore();

  const isExpanded = expanded.has(node.path);
  const isActive = activeFile === node.path;
  const isWriting = activelyWritingFile === node.path;

  const handleClick = () => {
    if (node.type === 'directory') {
      onToggle(node.path);
    } else {
      openTab(node.path);
      setActiveFile(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 cursor-pointer rounded-md text-sm transition-all duration-150',
          isActive
            ? 'bg-violet-500/10 text-zinc-200 border-l-2 border-violet-500 ml-0'
            : 'hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-l-2 border-transparent',
          isWriting && 'writing-pulse'
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={handleClick}
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
        <span className="truncate">{node.name}</span>
      </div>

      {node.type === 'directory' && isExpanded && node.children && (
        <div className="animate-fade-in" style={{ animationDuration: '0.15s' }}>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTree({ tree }: FileTreeProps) {
  // Auto-expand: all directories start expanded
  const allDirs = useMemo(() => collectDirPaths(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // When new directories appear, auto-expand them
  useEffect(() => {
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const dir of allDirs) {
        if (!next.has(dir)) {
          next.add(dir);
          changed = true;
        }
      }
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

  if (tree.length === 0) {
    return (
      <div className="text-zinc-600 text-xs p-4 text-center animate-fade-in">
        No files yet
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
        />
      ))}
    </div>
  );
}