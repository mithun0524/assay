import { create } from 'zustand';
import { ActionHistory } from './actionHistory';

export type FileEntry = {
  content: string;
  language: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  displayContent: string;
  timestamp: number;
};

export type SandboxStatus =
  | 'idle'
  | 'booting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

export type PendingChange = {
  filePath: string;
  oldContent: string | null; // null if new file
  newContent: string;
  language: string;
  status: 'pending' | 'accepted' | 'rejected';
};

type AppStore = {
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateLastAssistantMessage: (content: string, displayContent: string) => void;
  setMessages: (msgs: Message[]) => void;
  clearMessages: () => void;

  files: Record<string, FileEntry>;
  setFile: (path: string, entry: FileEntry) => void;
  deleteFile: (path: string) => void;
  clearFiles: () => void;

  activeFile: string | null;
  setActiveFile: (path: string | null) => void;
  openTabs: string[];
  openTab: (path: string) => void;
  closeTab: (path: string) => void;

  sandboxStatus: SandboxStatus;
  setSandboxStatus: (s: SandboxStatus) => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;

  terminalOutput: string;
  terminalInstance: any | null;
  setTerminalInstance: (instance: any | null) => void;
  appendTerminal: (text: string) => void;
  clearTerminal: () => void;

  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;

  selectedModel: string;
  setSelectedModel: (m: string) => void;

  hasProject: boolean;
  setHasProject: (v: boolean) => void;

  activelyWritingFile: string | null;
  setActivelyWritingFile: (path: string | null) => void;

  generationPhase: 'idle' | 'writing' | 'installing' | 'starting' | 'done';
  setGenerationPhase: (phase: 'idle' | 'writing' | 'installing' | 'starting' | 'done') => void;

  previewErrors: string[];
  addPreviewError: (err: string) => void;
  clearPreviewErrors: () => void;

  apiKey: string | null;
  setApiKey: (key: string | null) => void;

  rateLimitUntil: number | null;
  setRateLimitUntil: (ts: number | null) => void;

  tokenUsage: number;
  setTokenUsage: (tokens: number) => void;

  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  currentTemplateId: string | null;
  setCurrentTemplateId: (id: string | null) => void;

  pendingChanges: PendingChange[];
  setPendingChanges: (changes: PendingChange[]) => void;
  acceptChange: (filePath: string) => void;
  rejectChange: (filePath: string) => void;
  acceptAllChanges: () => void;
  rejectAllChanges: () => void;
  clearPendingChanges: () => void;
  applyAcceptedChanges: () => Promise<void>;

  showDiffPreview: boolean;
  setShowDiffPreview: (show: boolean) => void;

  githubToken: string | null;
  githubUser: { login: string; name: string | null; avatar_url: string } | null;
  githubRepo: { owner: string; name: string; url: string } | null;
  setGitHubToken: (token: string | null) => void;
  setGitHubUser: (user: { login: string; name: string | null; avatar_url: string } | null) => void;
  setGitHubRepo: (repo: { owner: string; name: string; url: string } | null) => void;
  disconnectGitHub: () => void;

  componentEditMode: {
    active: boolean;
    filePath: string | null;
    componentName: string | null;
  };
  setComponentEditMode: (mode: {
    active: boolean;
    filePath: string | null;
    componentName: string | null;
  }) => void;

  activeAgent: string | null;
  setActiveAgent: (agent: string | null) => void;

  designMode: boolean;
  setDesignMode: (enabled: boolean) => void;
  inspectedElement: any | null;
  setInspectedElement: (element: any | null) => void;
};

const actionHistory = new ActionHistory();

export const useStore = create<AppStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistantMessage: (content, displayContent) =>
    set((s) => {
      const msgs = [...s.messages];
      const lastIdx = msgs.map((m) => m.role).lastIndexOf('assistant');
      if (lastIdx >= 0) msgs[lastIdx] = { ...msgs[lastIdx], content, displayContent };
      return { messages: msgs };
    }),
  clearMessages: () => set({ messages: [] }),
  setMessages: (msgs) => set({ messages: msgs }),

  files: {},
  setFile: (path, entry) => set((s) => ({ files: { ...s.files, [path]: entry } })),
  deleteFile: (path) =>
    set((s) => {
      const f = { ...s.files };
      delete f[path];
      return { files: f };
    }),
  clearFiles: () => set({ files: {} }),

  activeFile: null,
  setActiveFile: (path) => set({ activeFile: path }),
  openTabs: [],
  openTab: (path) =>
    set((s) => ({
      openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
      activeFile: path,
    })),
  closeTab: (path) =>
    set((s) => {
      const tabs = s.openTabs.filter((t) => t !== path);
      return {
        openTabs: tabs,
        activeFile: s.activeFile === path ? (tabs[tabs.length - 1] ?? null) : s.activeFile,
      };
    }),

  sandboxStatus: 'idle',
  setSandboxStatus: (s) => set({ sandboxStatus: s }),
  previewUrl: null,
  setPreviewUrl: (url) => set({ previewUrl: url }),

  terminalOutput: '',
  terminalInstance: null,
  setTerminalInstance: (instance) => set({ terminalInstance: instance }),
  appendTerminal: (() => {
    // Buffer terminal output and flush on next animation frame to prevent
    // "Maximum update depth exceeded" from rapid synchronous set() calls.
    let buffer = '';
    let rafId: ReturnType<typeof requestAnimationFrame> | null = null;

    // Error patterns from Vite / TypeScript / runtime
    const ERROR_PATTERNS = [
      /Failed to resolve import ["']([^"']+)["']/,
      /\[vite\] Internal server error:\s*(.+)/,
      /✘ \[ERROR\]\s*(.+)/,
      /SyntaxError:\s*(.+)/,
      /TypeError:\s*(.+)/,
      /ReferenceError:\s*(.+)/,
      /error TS\d+:\s*(.+)/,
      /Module not found:\s*(.+)/,
      /Cannot find module\s+["']([^"']+)["']/,
      /Unexpected token/,
    ];

    // Debounce error detection to avoid duplicate triggers
    let errorDebounce: ReturnType<typeof setTimeout> | null = null;

    return (text: string) => {
      // Write to xterm immediately for smooth visual output
      const instance = useStore.getState().terminalInstance;
      instance?.write(text);

      // Buffer state updates and flush on next frame
      buffer += text;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          const pending = buffer;
          buffer = '';
          rafId = null;
          set((s) => ({ terminalOutput: s.terminalOutput + pending }));
        });
      }

      // Detect errors in terminal output (debounced)
      if (errorDebounce) clearTimeout(errorDebounce);
      errorDebounce = setTimeout(() => {
        // Strip ANSI escape codes for pattern matching
        const clean = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        for (const pattern of ERROR_PATTERNS) {
          const match = clean.match(pattern);
          if (match) {
            const errorMsg = match[0].trim();
            useStore.getState().addPreviewError(errorMsg);
            break;
          }
        }
        errorDebounce = null;
      }, 300);
    };
  })(),
  clearTerminal: () => {
    const instance = useStore.getState().terminalInstance;
    set({ terminalOutput: '' });
    instance?.clear();
  },

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  selectedModel: 'stepfun/step-3.5-flash:free', // Reliable fallback model
  setSelectedModel: (m) => set({ selectedModel: m }),

  hasProject: false,
  setHasProject: (v) => set({ hasProject: v }),

  activelyWritingFile: null,
  setActivelyWritingFile: (path) => set({ activelyWritingFile: path }),

  generationPhase: 'idle',
  setGenerationPhase: (phase) => set({ generationPhase: phase }),

  previewErrors: [],
  addPreviewError: (err) =>
    set((s) => ({
      previewErrors: s.previewErrors.includes(err)
        ? s.previewErrors
        : [...s.previewErrors, err].slice(-10),
    })),
  clearPreviewErrors: () => set({ previewErrors: [] }),

  apiKey: typeof window !== 'undefined' ? localStorage.getItem('openrouter-api-key') : null,
  setApiKey: (key) => {
    if (key) {
      localStorage.setItem('openrouter-api-key', key);
    } else {
      localStorage.removeItem('openrouter-api-key');
    }
    set({ apiKey: key });
  },

  rateLimitUntil: null,
  setRateLimitUntil: (ts) => set({ rateLimitUntil: ts }),

  tokenUsage: 0,
  setTokenUsage: (tokens) => set({ tokenUsage: tokens }),

  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  canUndo: false,
  canRedo: false,
  takeSnapshot: () => {
    const files = useStore.getState().files;
    actionHistory.take(files);
    set({ canUndo: actionHistory.canUndo, canRedo: actionHistory.canRedo });
  },
  undo: () => {
    const snapshot = actionHistory.undo();
    if (!snapshot) return;
    set({
      files: snapshot.files,
      canUndo: actionHistory.canUndo,
      canRedo: actionHistory.canRedo,
    });
    // Sync files back to WebContainer
    import('./fileSystem').then(({ writeFileToSandbox }) => {
      Object.entries(snapshot.files).forEach(([path, entry]) => {
        writeFileToSandbox(path, entry.content).catch(console.error);
      });
    });
  },
  redo: () => {
    const snapshot = actionHistory.redo();
    if (!snapshot) return;
    set({
      files: snapshot.files,
      canUndo: actionHistory.canUndo,
      canRedo: actionHistory.canRedo,
    });
    // Sync files back to WebContainer
    import('./fileSystem').then(({ writeFileToSandbox }) => {
      Object.entries(snapshot.files).forEach(([path, entry]) => {
        writeFileToSandbox(path, entry.content).catch(console.error);
      });
    });
  },

  currentTemplateId: null,
  setCurrentTemplateId: (id) => set({ currentTemplateId: id }),

  pendingChanges: [],
  setPendingChanges: (changes) => set({ pendingChanges: changes }),
  acceptChange: (filePath) =>
    set((s) => ({
      pendingChanges: s.pendingChanges.map((c) =>
        c.filePath === filePath ? { ...c, status: 'accepted' } : c
      ),
    })),
  rejectChange: (filePath) =>
    set((s) => ({
      pendingChanges: s.pendingChanges.map((c) =>
        c.filePath === filePath ? { ...c, status: 'rejected' } : c
      ),
    })),
  acceptAllChanges: () =>
    set((s) => ({
      pendingChanges: s.pendingChanges.map((c) => ({ ...c, status: 'accepted' })),
    })),
  rejectAllChanges: () =>
    set((s) => ({
      pendingChanges: s.pendingChanges.map((c) => ({ ...c, status: 'rejected' })),
    })),
  clearPendingChanges: () => set({ pendingChanges: [] }),
  applyAcceptedChanges: async () => {
    const { pendingChanges, setFile, takeSnapshot } = useStore.getState();
    const accepted = pendingChanges.filter((c) => c.status === 'accepted');

    // Apply each accepted change
    for (const change of accepted) {
      setFile(change.filePath, {
        content: change.newContent,
        language: change.language,
      });

      // Write to WebContainer
      const { writeFileToSandbox } = await import('./fileSystem');
      await writeFileToSandbox(change.filePath, change.newContent);
    }

    // Take snapshot and clear pending changes
    takeSnapshot();
    set({ pendingChanges: [] });
  },

  showDiffPreview: typeof window !== 'undefined'
    ? localStorage.getItem('show-diff-preview') === 'true'
    : false,
  setShowDiffPreview: (show) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('show-diff-preview', String(show));
    }
    set({ showDiffPreview: show });
  },

  githubToken: null,
  githubUser: null,
  githubRepo: null,
  setGitHubToken: (token) => set({ githubToken: token }),
  setGitHubUser: (user) => set({ githubUser: user }),
  setGitHubRepo: (repo) => set({ githubRepo: repo }),
  disconnectGitHub: () => {
    // Clear GitHub data from store
    set({ githubToken: null, githubUser: null, githubRepo: null });
    // Clear from localStorage via auth utility
    import('./githubAuth').then(({ removeGitHubToken }) => {
      removeGitHubToken();
    });
  },

  componentEditMode: {
    active: false,
    filePath: null,
    componentName: null,
  },
  setComponentEditMode: (mode) => set({ componentEditMode: mode }),

  activeAgent: null,
  setActiveAgent: (agent) => set({ activeAgent: agent }),

  designMode: false,
  setDesignMode: (enabled) => set({ designMode: enabled }),
  inspectedElement: null,
  setInspectedElement: (element) => set({ inspectedElement: element }),
}));