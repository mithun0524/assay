'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import { RiFileCodeLine } from '@remixicon/react';
import { X, FileCode, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/lib/store';
import { FileTree } from './FileTree';
import { InlineEditPopup } from './InlineEditPopup';
import { buildFileTree, cn } from '@/lib/utils';
import { writeFileToSandbox } from '@/lib/fileSystem';
import { checkAndNotifyMissingDependencies } from '@/lib/dependencyHelper';
import { registerAutocompleteProvider } from '@/lib/autocomplete';
import { useChat } from '@/hooks/useChat';
import type * as Monaco from 'monaco-editor';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  { ssr: false }
);

export function EditorPanel() {
  const { files, activeFile, openTabs, closeTab, closeOtherTabs, closeAllTabs, setFile, setActiveFile, dirtyFiles, markDirty, markClean, isStreaming } = useStore();
  const [editorContent, setEditorContent] = useState('');
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);
  const { submit } = useChat();

  // Inline edit popup state
  const [inlineEditPopup, setInlineEditPopup] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
    selectedText: string;
    selection: Monaco.IRange | null;
  }>({
    isOpen: false,
    position: null,
    selectedText: '',
    selection: null,
  });

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const fileTree = buildFileTree(files);

  // Update editor content when active file changes or content is updated externally (e.g. AI streaming)
  // Skip if the store content matches what the editor already has (our own save) to preserve cursor position
  const prevActiveFileRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeFile && files[activeFile]) {
      const storeContent = files[activeFile].content;
      if (activeFile !== prevActiveFileRef.current) {
        // Switched files — always sync
        setEditorContent(storeContent);
        prevActiveFileRef.current = activeFile;
      } else if (storeContent !== editorContent) {
        // Same file but content changed externally (AI edit, undo/redo from store)
        // Only update if the editor didn't originate this change
        const editorValue = editorRef.current?.getValue();
        if (editorValue !== undefined && storeContent !== editorValue) {
          setEditorContent(storeContent);
        }
      }
    } else {
      setEditorContent('');
      prevActiveFileRef.current = activeFile;
    }
  }, [activeFile, files]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFile || !value) return;

    setEditorContent(value);
    markDirty(activeFile);

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
      writeFileToSandbox(activeFile, value)
        .then(() => {
          markClean(activeFile);
          // Check for missing dependencies after file is saved
          checkAndNotifyMissingDependencies(activeFile, value).catch(console.error);
        })
        .catch(console.error);
    }, 500);
  }, [activeFile, files, setFile, markDirty, markClean]);

  // Ctrl+S / Cmd+S — save active file immediately
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeFile && files[activeFile]) {
          writeFileToSandbox(activeFile, files[activeFile].content)
            .then(() => {
              markClean(activeFile);
              // Check for missing dependencies after manual save
              checkAndNotifyMissingDependencies(activeFile, files[activeFile].content).catch(console.error);
            })
            .catch(console.error);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeFile, files, markClean]);

  const handleTabClose = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    closeTab(path);
  };

  const handleTabContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, path });
  };

  // Close context menu on click outside or Escape
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

  // Handle Monaco editor mount
  const handleEditorMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    editorRef.current = editor;

    // Register AI autocomplete provider (ghost text)
    const autocompleteDisposable = registerAutocompleteProvider(monaco);
    // Clean up on editor dispose
    editor.onDidDispose(() => autocompleteDisposable.dispose());

    // Register CMD+K keyboard action for inline editing
    editor.addAction({
      id: 'inline-edit',
      label: 'AI Inline Edit',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      run: (ed) => {
        const selection = ed.getSelection();
        if (!selection || selection.isEmpty()) {
          return;
        }

        const selectedText = ed.getModel()?.getValueInRange(selection) || '';
        if (!selectedText.trim()) {
          return;
        }

        // Get cursor position in screen coordinates
        const position = ed.getScrolledVisiblePosition(selection.getStartPosition());
        if (!position) {
          return;
        }

        const editorDomNode = ed.getDomNode();
        if (!editorDomNode) {
          return;
        }

        const rect = editorDomNode.getBoundingClientRect();

        setInlineEditPopup({
          isOpen: true,
          position: {
            x: rect.left + position.left,
            y: rect.top + position.top + 20, // Offset below cursor
          },
          selectedText,
          selection,
        });
      },
    });
  }, []);

  // Handle inline edit submission
  const handleInlineEditSubmit = useCallback(async (instruction: string) => {
    if (!activeFile || !inlineEditPopup.selectedText || !inlineEditPopup.selection) {
      return;
    }

    // Format prompt for inline editing
    const prompt = `I want to edit the following code in ${activeFile}:

\`\`\`
${inlineEditPopup.selectedText}
\`\`\`

Instruction: ${instruction}

Please modify ONLY the selected code above based on the instruction. Return the complete modified code that should replace the selection.`;

    // Close popup and submit
    setInlineEditPopup({ isOpen: false, position: null, selectedText: '', selection: null });

    // Submit to chat
    await submit(prompt);
  }, [activeFile, inlineEditPopup, submit]);

  // Breadcrumb segments
  const breadcrumbSegments = activeFile ? activeFile.split('/') : [];

  return (
    <div className="flex h-full bg-[#09090b]">
      {/* File tree sidebar */}
      <div className="w-48 shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="panel-header px-3 py-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
          Files
        </div>
        <div className="flex-1 min-h-0">
          <FileTree tree={fileTree} />
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center border-b border-white/[0.06] bg-[#09090b] overflow-x-auto">
          <AnimatePresence initial={false}>
            {openTabs.map((tab) => (
              <motion.div
                key={tab}
                layout
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setActiveFile(tab)}
                onContextMenu={(e) => handleTabContextMenu(e, tab)}
                className={cn(
                  'group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-white/[0.04] min-w-0 transition-colors relative',
                  tab === activeFile
                    ? 'bg-white/[0.04] text-zinc-200 tab-active'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                )}
              >
                {dirtyFiles.has(tab) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 shrink-0" />
                )}
                <FileCode className={cn(
                  'w-3.5 h-3.5 shrink-0 transition-colors',
                  tab === activeFile ? 'text-zinc-200' : 'text-zinc-500'
                )} />
                <span className="truncate">{tab.split('/').pop()}</span>
                <button
                  onClick={(e) => handleTabClose(e, tab)}
                  className="p-0.5 hover:bg-white/[0.06] rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Breadcrumb */}
        {activeFile && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/[0.06] bg-[#09090b] text-xs overflow-x-auto">
            {breadcrumbSegments.map((segment, i) => {
              const isLast = i === breadcrumbSegments.length - 1;
              return (
                <span key={i} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-zinc-600" />}
                  <span className={isLast ? 'text-zinc-300 font-medium' : 'text-zinc-500'}>
                    {segment}
                  </span>
                </span>
              );
            })}
          </div>
        )}

        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          {activeFile && files[activeFile] ? (
            <MonacoEditor
              language={files[activeFile].language}
              value={editorContent}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
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
                inlineSuggest: { enabled: true },
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

      {/* Tab context menu */}
      {contextMenu && (
        <div
          className="fixed bg-[#18181b] border border-white/[0.1] shadow-xl rounded-xl py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { closeTab(contextMenu.path); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { closeOtherTabs(contextMenu.path); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors"
          >
            Close Others
          </button>
          <button
            onClick={() => { closeAllTabs(); setContextMenu(null); }}
            className="w-full px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06] text-left transition-colors"
          >
            Close All
          </button>
        </div>
      )}

      {/* Inline Edit Popup */}
      <InlineEditPopup
        isOpen={inlineEditPopup.isOpen}
        position={inlineEditPopup.position}
        selectedText={inlineEditPopup.selectedText}
        onSubmit={handleInlineEditSubmit}
        onClose={() => setInlineEditPopup({ isOpen: false, position: null, selectedText: '', selection: null })}
        isLoading={isStreaming}
      />
    </div>
  );
}
