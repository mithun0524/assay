import { create } from 'zustand';
import type { Tier } from './surfaces';
import { ActionHistory } from './actionHistory';
import { detectTerminalErrors } from './terminalErrorDetector';
import { AUTO_MODEL_ID } from './openrouter';
import type { AgentRole } from './agents/types';

export type FileEntry = {
  content: string;
  language: string;
};

export type GenerationPhase =
  | 'idle'
  | 'writing'
  | 'installing'
  | 'starting'
  | 'searching'
  | 'verifying'
  | 'done';

export type QaStatus = {
  state: 'fixing' | 'passed' | 'failed';
  summary: string;
  attempt: number;
  maxAttempts: number;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  /** Machine-generated turns the client injects on the agent's behalf. */
  kind?: 'qa' | 'inspect' | 'search';
  /** Which specialist produced this turn — drives the rail colour in the transcript. */
  agent?: AgentRole;
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
  setLastAssistantAgent: (agent: AgentRole) => void;
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
  closeOtherTabs: (keepPath: string) => void;
  closeAllTabs: () => void;

  dirtyFiles: Set<string>;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;

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

  viewTier: Tier;
  setViewTier: (tier: Tier) => void;
  activelyWritingFile: string | null;
  setActivelyWritingFile: (path: string | null) => void;

  generationPhase: GenerationPhase;
  setGenerationPhase: (phase: GenerationPhase) => void;

  webSearchEnabled: boolean;
  setWebSearchEnabled: (v: boolean) => void;
  isSearching: boolean;
  setIsSearching: (v: boolean) => void;
  lastSearchResults: string | null;
  setLastSearchResults: (r: string | null) => void;

  previewErrors: string[];
  addPreviewError: (err: string) => void;
  clearPreviewErrors: () => void;

  terminalErrors: string[];
  addTerminalError: (err: string) => void;
  clearTerminalErrors: () => void;


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

  githubUser: { login: string; name: string | null; avatar_url: string } | null;
  githubRepo: { owner: string; name: string; url: string } | null;
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

  qaStatus: QaStatus | null;
  setQaStatus: (status: QaStatus | null) => void;

  activeAgent: AgentRole | null;
  setActiveAgent: (agent: AgentRole | null) => void;
  activeAgentReasoning: string | null;
  setActiveAgentReasoning: (reason: string | null) => void;

  designMode: boolean;
  setDesignMode: (enabled: boolean) => void;
  inspectedElement: any | null;
  setInspectedElement: (element: any | null) => void;

  vercelProjectId: string | null;
  setVercelProjectId: (id: string | null) => void;
  lastDeployUrl: string | null;
  setLastDeployUrl: (url: string | null) => void;
};

const actionHistory = new ActionHistory();

export const useStore = create<AppStore>((set) => ({
  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateLastAssistantMessage: (content, displayContent) =>
    set((s) => {
      const msgs = s.messages;
      // Reverse loop is O(1) in practice (last msg is almost always the target)
      let lastIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') { lastIdx = i; break; }
      }
      if (lastIdx < 0) return s;
      // Skip update if content hasn't actually changed
      const existing = msgs[lastIdx];
      if (existing.content === content && existing.displayContent === displayContent) return s;
      const next = msgs.slice();
      next[lastIdx] = { ...existing, content, displayContent };
      return { messages: next };
    }),
  setLastAssistantAgent: (agent) =>
    set((s) => {
      const msgs = s.messages;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          if (msgs[i].agent === agent) return s;
          const next = msgs.slice();
          next[i] = { ...next[i], agent };
          return { messages: next };
        }
      }
      return s;
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
  closeOtherTabs: (keepPath) =>
    set((s) => ({
      openTabs: s.openTabs.includes(keepPath) ? [keepPath] : [],
      activeFile: s.openTabs.includes(keepPath) ? keepPath : null,
    })),
  closeAllTabs: () => set({ openTabs: [], activeFile: null }),

  dirtyFiles: new Set<string>(),
  markDirty: (path) =>
    set((s) => {
      if (s.dirtyFiles.has(path)) return s;
      const next = new Set(s.dirtyFiles);
      next.add(path);
      return { dirtyFiles: next };
    }),
  markClean: (path) =>
    set((s) => {
      if (!s.dirtyFiles.has(path)) return s;
      const next = new Set(s.dirtyFiles);
      next.delete(path);
      return { dirtyFiles: next };
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
    // Accumulate recent chunks for error scanning
    let errorScanBuffer = '';
    let errorScanTimer: ReturnType<typeof setTimeout> | null = null;

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

      // Debounced error scanning — only when not streaming AI output
      errorScanBuffer += text;
      if (errorScanTimer) clearTimeout(errorScanTimer);
      errorScanTimer = setTimeout(() => {
        const { isStreaming } = useStore.getState();
        if (!isStreaming) {
          const errors = detectTerminalErrors(errorScanBuffer);
          if (errors) {
            for (const err of errors) {
              useStore.getState().addTerminalError(err);
            }
          }
        }
        errorScanBuffer = '';
        errorScanTimer = null;
      }, 500);
    };
  })(),
  clearTerminal: () => {
    const instance = useStore.getState().terminalInstance;
    set({ terminalOutput: '', terminalErrors: [] });
    instance?.clear();
  },

  isStreaming: false,
  setIsStreaming: (v) => set({ isStreaming: v }),

  selectedModel: AUTO_MODEL_ID, // 'auto' = let the agent router pick per message
  setSelectedModel: (m) => set({ selectedModel: m }),

  hasProject: false,
  setHasProject: (v) => set({ hasProject: v }),

  activelyWritingFile: null,
  setActivelyWritingFile: (path) => set({ activelyWritingFile: path }),

  generationPhase: 'idle',
  setGenerationPhase: (phase) => set({ generationPhase: phase }),

  webSearchEnabled: false,
  setWebSearchEnabled: (v) => set({ webSearchEnabled: v }),
  isSearching: false,
  setIsSearching: (v) => set({ isSearching: v }),
  lastSearchResults: null,
  setLastSearchResults: (r) => set({ lastSearchResults: r }),

  previewErrors: [],
  addPreviewError: (err) =>
    set((s) => ({
      previewErrors: s.previewErrors.includes(err)
        ? s.previewErrors
        : [...s.previewErrors, err].slice(-10),
    })),
  clearPreviewErrors: () => set({ previewErrors: [] }),

  terminalErrors: [],
  addTerminalError: (err) =>
    set((s) => ({
      terminalErrors: s.terminalErrors.includes(err)
        ? s.terminalErrors
        : [...s.terminalErrors, err].slice(-10),
    })),
  clearTerminalErrors: () => set({ terminalErrors: [] }),


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

  // Which surfaces the workspace offers. Defaults to 'simple': someone who
  // typed "a task management app" wants to watch the app, not the scaffold.
  // Intended to be set by an onboarding step later — only lib/surfaces.ts
  // interprets this value, so nothing else changes when that lands.
  viewTier: typeof window !== 'undefined' && localStorage.getItem('view-tier') === 'developer'
    ? 'developer'
    : 'simple',
  setViewTier: (tier) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('view-tier', tier);
    }
    set({ viewTier: tier });
  },

  githubUser: null,
  githubRepo: null,
  setGitHubUser: (user) => set({ githubUser: user }),
  setGitHubRepo: (repo) => set({ githubRepo: repo }),
  disconnectGitHub: () => {
    set({ githubUser: null, githubRepo: null });
  },

  componentEditMode: {
    active: false,
    filePath: null,
    componentName: null,
  },
  setComponentEditMode: (mode) => set({ componentEditMode: mode }),

  qaStatus: null,
  setQaStatus: (status) => set({ qaStatus: status }),

  activeAgent: null,
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  activeAgentReasoning: null,
  setActiveAgentReasoning: (reason) => set({ activeAgentReasoning: reason }),

  designMode: false,
  setDesignMode: (enabled) => set({ designMode: enabled }),
  inspectedElement: null,
  setInspectedElement: (element) => set({ inspectedElement: element }),

  vercelProjectId: null,
  setVercelProjectId: (id) => set({ vercelProjectId: id }),
  lastDeployUrl: null,
  setLastDeployUrl: (url) => set({ lastDeployUrl: url }),
}));