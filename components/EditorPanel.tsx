'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { RiCloseLine, RiFileCodeLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { FileTree } from './FileTree';
import { buildFileTree } from '@/lib/utils';
import { writeFileToSandbox } from '@/lib/fileSystem';
import { cn } from '@/lib/utils';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  { ssr: false }
);

export function EditorPanel() {
  const { files, activeFile, openTabs, closeTab, setFile, setActiveFile } = useStore();
  const [editorContent, setEditorContent] = useState('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fileTree = buildFileTree(files);

  // Update editor content when active file changes
  useEffect(() => {
    if (activeFile && files[activeFile]) {
      setEditorContent(files[activeFile].content);
    } else {
      setEditorContent('');
    }
  }, [activeFile, files]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFile || !value) return;

    setEditorContent(value);

    // Debounce file updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      setFile(activeFile, {
        content: value,
        language: files[activeFile].language,
      });
      // Sync to WebContainer so Vite HMR picks up the change
      writeFileToSandbox(activeFile, value).catch(console.error);
    }, 500);
  }, [activeFile, files, setFile]);

  // Ctrl+S / Cmd+S — save active file immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && files[activeFile]) {
          writeFileToSandbox(activeFile, files[activeFile].content).catch(console.error);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, files]);

  const handleTabClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    closeTab(path);
  };

  return (
    <div className="flex h-full bg-[#09090b]">
      {/* File tree sidebar */}
      <div className="w-48 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="panel-header px-3 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          Files
        </div>
        <div className="flex-1 overflow-y-auto">
          <FileTree tree={fileTree} />
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-white/[0.06] bg-[#09090b] overflow-x-auto">
          {openTabs.map((tab) => (
            <div
              key={tab}
              onClick={() => setActiveFile(tab)}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-white/[0.04] min-w-0 transition-all relative',
                tab === activeFile
                  ? 'bg-white/[0.04] text-zinc-200 tab-active'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
              )}
            >
              <RiFileCodeLine className={cn(
                'w-3.5 h-3.5 shrink-0 transition-colors',
                tab === activeFile ? 'text-violet-400' : 'text-zinc-600'
              )} />
              <span className="truncate">{tab.split('/').pop()}</span>
              <button
                onClick={(e) => handleTabClose(e, tab)}
                className="p-0.5 hover:bg-white/[0.08] rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <RiCloseLine className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          {activeFile && files[activeFile] ? (
            <MonacoEditor
              language={files[activeFile].language}
              value={editorContent}
              onChange={handleEditorChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8 },
                fontFamily: "'Geist Mono', 'Fira Code', 'Cascadia Code', monospace",
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 animate-fade-in">
              <div className="text-center">
                <RiFileCodeLine className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs text-zinc-600">No files open</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}