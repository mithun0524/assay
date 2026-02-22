'use client';

import { useEffect, useState, useCallback } from 'react';
import { RiLoader4Line, RiErrorWarningLine } from '@remixicon/react';
import { MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebContainer } from '@/hooks/useWebContainer';
import { useStore } from '@/lib/store';
import { loadProject, saveProject, getAllProjects, getActiveProjectId, setActiveProjectId, createNewProject } from '@/lib/db';
import { writeFileToSandbox } from '@/lib/fileSystem';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { ChatPanel } from './ChatPanel';
import { WorkspacePanel } from './WorkspacePanel';
import { WelcomeScreen } from './WelcomeScreen';
import { ProjectSidebar } from './ProjectSidebar';
import { DiffViewer } from './DiffViewer';
import { QuickFilePicker } from './QuickFilePicker';
import { FindInFiles } from './FindInFiles';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { Tooltip } from './Tooltip';
import { useAuthContext } from './Providers';

export function WorkspaceLayout() {
  const {
    sandboxStatus,
    files,
    setFile,
    hasProject,
    setHasProject,
    messages,
    setMessages,
    currentProjectId,
    setCurrentProjectId,
    clearFiles,
    clearMessages,
    clearTerminal,
    setPreviewUrl,
    setSandboxStatus,
    pendingChanges
  } = useStore();

  const { user, isGitHubLinked } = useAuthContext();

  const [isMobile, setIsMobile] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [leftWidth, setLeftWidth] = useState(340);
  const [isDragging, setIsDragging] = useState(false);
  const [browserWarning, setBrowserWarning] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [isFindInFilesOpen, setIsFindInFilesOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);

  // Mobile & Online check
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    handleResize();
    setIsOnline(navigator.onLine);

    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Cmd+P / Ctrl+P -> Quick File Picker
      if (mod && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setIsFilePickerOpen((v) => !v);
        setIsFindInFilesOpen(false);
      }
      // Cmd+Shift+F / Ctrl+Shift+F -> Find in Files
      if (mod && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsFindInFilesOpen((v) => !v);
        setIsFilePickerOpen(false);
      }
      // Cmd+/ / Ctrl+/ -> Keyboard Shortcuts
      if (mod && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((v) => !v);
      }
      // Cmd+B / Ctrl+B -> Toggle Chat Panel
      if (mod && e.key === 'b') {
        e.preventDefault();
        setIsChatCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Boot WebContainer
  useWebContainer();

  // Check browser compatibility
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isChromium = navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edg');
      if (!isChromium) {
        setBrowserWarning(true);
      }
    }
  }, []);

  // Fetch GitHub user and stored API key when authenticated
  useEffect(() => {
    if (!user) return;

    if (isGitHubLinked) {
      fetch('/api/github/user')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            useStore.getState().setGitHubUser({
              login: data.login,
              name: data.name,
              avatar_url: data.avatar_url,
            });
          }
        })
        .catch(console.error);
    }

    fetch('/api/user/secrets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.openrouterKey) {
          useStore.getState().setApiKey(data.openrouterKey);
        }
      })
      .catch(console.error);
  }, [user, isGitHubLinked]);

  // Track whether user has a project (files or messages)
  useEffect(() => {
    if (Object.keys(files).length > 0 || messages.length > 0) {
      setHasProject(true);
    }
  }, [files, messages, setHasProject]);

  // Auto-save project (files + messages)
  useEffect(() => {
    if (!currentProjectId) return;

    const timer = setTimeout(() => {
      saveProject(currentProjectId, files, messages).catch(console.error);
    }, 2000);

    return () => clearTimeout(timer);
  }, [files, messages, currentProjectId]);

  // Restore project on mount
  useEffect(() => {
    const init = async () => {
      try {
        let activeId = await getActiveProjectId();

        // If no active project, try to find the most recent one
        if (!activeId) {
          const projects = await getAllProjects();
          if (projects.length > 0) {
            activeId = projects[0].id;
            await setActiveProjectId(activeId);
          }
        }

        if (activeId) {
          const project = await loadProject(activeId);
          if (project) {
            setCurrentProjectId(activeId);
            setMessages(project.messages || []);

            // Restore files into store immediately (doesn't need WebContainer)
            if (project.files) {
              Object.entries(project.files).forEach(([path, entry]) => {
                setFile(path, entry);
              });
            }
            setHasProject(true);

            // Write files to WebContainer in the background (don't block loading)
            if (project.files) {
              (async () => {
                try {
                  const entries = Object.entries(project.files!);
                  await Promise.all(
                    entries.map(([path, entry]) =>
                      writeFileToSandbox(path, entry.content).catch(console.error)
                    )
                  );
                  if (project.files!['package.json']) {
                    const { installDependencies } = await import('@/lib/fileSystem');
                    await installDependencies();
                  }
                } catch (err) {
                  console.error('Background sandbox restore failed:', err);
                }
              })();
            }
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectProject = async (id: string) => {
    if (id === currentProjectId) return;

    setIsLoading(true);
    try {
      // Clear current state
      clearFiles();
      clearMessages();
      clearTerminal();
      setPreviewUrl(null);
      setSandboxStatus('idle');

      // Load new project
      const project = await loadProject(id);
      if (project) {
        setCurrentProjectId(id);
        await setActiveProjectId(id);
        setMessages(project.messages || []);

        // Restore files
        if (project.files) {
          Object.entries(project.files).forEach(([path, entry]) => {
            setFile(path, entry);
            writeFileToSandbox(path, entry.content).catch(console.error);
          });
        }
        setHasProject(true);
      }
    } catch (error) {
      console.error('Failed to switch project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProject = async () => {
    clearFiles();
    clearMessages();
    clearTerminal();
    setPreviewUrl(null);
    setSandboxStatus('idle');
    setHasProject(false);
    setCurrentProjectId(null);
  };

  // Handle resize dragging
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newWidth = Math.max(300, Math.min(e.clientX, 600));
    setLeftWidth(newWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Show loading overlay when booting or loading project
  if (sandboxStatus === 'booting' || isLoading) {
    return (
      <div className="h-screen w-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden">
        <div className="gradient-mesh" />
        <div className="relative z-10 text-center animate-fade-up">
          <div className="relative mb-6">
            <RiLoader4Line className="w-8 h-8 text-violet-400 animate-spin mx-auto" />
            <div className="absolute inset-0 w-8 h-8 mx-auto rounded-full bg-violet-500/20 blur-xl" />
          </div>
          <p className="text-zinc-300 text-sm font-medium">
            {isLoading ? 'Loading project...' : 'Initializing environment'}
          </p>
          <p className="text-zinc-600 text-xs mt-1.5">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  // Show welcome screen when no project exists
  if (!hasProject) {
    return (
      <>
        <ProjectSidebar
          isOpen={isProjectsOpen}
          onClose={() => setIsProjectsOpen(false)}
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
        />
        <WelcomeScreen />
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={() => setIsProjectsOpen(true)}
            className="p-2 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg text-zinc-400 hover:text-zinc-100 transition-all border border-white/[0.06]"
            title="Projects"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 2H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#09090b] overflow-hidden">
      {/* Offline Warning */}
      {!isOnline && (
        <div className="px-4 py-1.5 bg-red-500/10 border-b border-red-500/20 text-red-300 text-xs font-medium flex items-center justify-center gap-2">
          <RiErrorWarningLine className="w-3.5 h-3.5" />
          <span>You are offline. Some features may be unavailable.</span>
        </div>
      )}

      {/* Browser warning */}
      {browserWarning && (
        <div className="px-4 py-2 glass border-b border-white/[0.06] text-zinc-400 text-xs flex items-center gap-2">
          <RiErrorWarningLine className="w-3.5 h-3.5 text-amber-400/70" />
          <span>Best experienced in Chrome or Edge — WebContainer requires a Chromium browser.</span>
        </div>
      )}

      {/* Header */}
      <Header onOpenProjects={() => setIsProjectsOpen(true)} onOpenShortcuts={() => setIsShortcutsOpen(true)} />

      {/* Project Sidebar */}
      <ProjectSidebar
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
      />

      {/* Main content — Responsive Layout */}
      <div className={cn(
        "flex-1 min-h-0 flex",
        isMobile ? "flex-col" : "flex-row"
      )}>
        {/* Chat panel */}
        {isMobile ? (
          <div className="w-full h-[45%] shrink-0 border-b border-white/[0.06]">
            <ChatPanel />
          </div>
        ) : (
          <>
            <motion.div
              className="shrink-0 border-r border-white/[0.06] bg-[#09090b] h-full overflow-hidden"
              animate={{ width: isChatCollapsed ? 48 : leftWidth }}
              transition={{ width: { duration: isDragging ? 0 : 0.25, ease: [0.25, 0.1, 0.25, 1] } }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isChatCollapsed ? (
                  <motion.div
                    key="collapsed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col items-center py-3 gap-2 h-full"
                  >
                    <Tooltip content="Open Chat" shortcut="⌘B" side="right">
                      <button
                        onClick={() => setIsChatCollapsed(false)}
                        className="relative p-2 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-all"
                      >
                        <MessageSquare className="w-5 h-5" />
                        {messages.length > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-violet-500 text-[10px] font-medium text-white">
                            {messages.length > 99 ? '99+' : messages.length}
                          </span>
                        )}
                      </button>
                    </Tooltip>
                  </motion.div>
                ) : (
                  <motion.div
                    key="expanded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <ChatPanel onCollapse={() => setIsChatCollapsed(true)} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Resize handle */}
            <AnimatePresence>
              {!isChatCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 4 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="resize-handle cursor-col-resize hover:bg-violet-500/30 transition-colors"
                  onMouseDown={() => setIsDragging(true)}
                />
              )}
            </AnimatePresence>
          </>
        )}

        {/* Workspace panel (Code / Preview / Terminal tabs) */}
        <div className="flex-1 min-w-0 min-h-0">
          <WorkspacePanel />
        </div>
      </div>

      {/* Diff Viewer Modal */}
      {pendingChanges.length > 0 && <DiffViewer />}

      {/* Search modals */}
      <QuickFilePicker isOpen={isFilePickerOpen} onClose={() => setIsFilePickerOpen(false)} />
      <FindInFiles isOpen={isFindInFilesOpen} onClose={() => setIsFindInFilesOpen(false)} />
      <KeyboardShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
    </div>
  );
}