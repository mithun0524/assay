# DevForge 🚀

**The Open-Source AI Code Editor That Runs Entirely in Your Browser**

DevForge is a powerful browser-based AI code editor built with Next.js, React 19, and WebContainers. It generates complete, production-ready applications with live preview, terminal access, and AI-powered assistance—all without any backend infrastructure.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)

## ✨ Features

### 🎯 Core Features
- **🤖 Multiple AI Models**: Choose from 5+ free LLM models via OpenRouter (DeepSeek, Llama 4, Gemini 2.0, QwQ)
- **💻 Full WebContainer Environment**: Complete Node.js runtime in your browser
- **👁️ Live Preview**: Instant preview with hot reload
- **🖥️ Integrated Terminal**: Full xterm.js terminal with command execution
- **📝 Monaco Editor**: VSCode-like code editing with syntax highlighting
- **📂 Multi-file Support**: Edit multiple files with tabs
- **↩️ Undo/Redo**: Time-travel through your changes with snapshots
- **💾 Project Persistence**: Auto-save to IndexedDB

### 🚀 Phase 1: Foundation Features (NEW!)
- **📋 Template System**: 5 production-ready templates for instant project start
  - Task Manager (Kanban board)
  - Weather Dashboard
  - Markdown Editor
  - Calculator
  - Portfolio Landing Page
- **🔍 Diff View**: Preview changes before applying them
- **📷 Screenshot-to-Code**: Upload UI mockups and get pixel-perfect code

### 🔗 Phase 2: Core Integrations (NEW!)
- **🐙 GitHub Integration**: Push, clone, and manage repos directly
- **🚢 One-Click Deployment**: Deploy to Vercel, Netlify, or Cloudflare Pages
- **🎯 Component Regeneration**: Edit specific components without rewriting entire apps

### 🎨 Phase 3: Advanced Features (NEW!)
- **🤝 Multi-Agent Architecture**: Specialized AI agents (Architect, Coder, Debugger, Designer, Tester)
- **🎨 Visual Design Mode**: Click-to-edit styling (Basic MVP)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- (Optional) OpenRouter API key for AI features

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/devforge.git
   cd devforge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env.local
   ```
   Add your OpenRouter API key to `.env.local`:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)**
.
---

## 📖 Usage Guide

### Starting a New Project

#### Option 1: From Template (Recommended)
1. Click **"Browse Templates"** on the welcome screen
2. Choose from 5 pre-built templates
3. Project loads instantly with live preview

#### Option 2: From AI Prompt
1. Describe what you want to build in the input box
2. Press **Enter** or click **"Start"**
3. Watch as AI generates your project

#### Option 3: Clone from GitHub
1. Click **"Clone from GitHub"** on the welcome screen
2. Enter a GitHub repository URL
3. Project imports with all files

### Using AI Chat

- **Type a prompt** and press Enter to generate code
- **Upload screenshots** (📎 icon) for UI generation
- **Diff preview**: Enable in Settings to review changes before applying
- **Auto-retry**: Errors are automatically sent back to AI for fixes

### GitHub Integration

1. **Connect GitHub**
   - Click "Connect GitHub" in the header
   - Enter your Personal Access Token
   - [Create token here](https://github.com/settings/tokens) with `repo` scope

2. **Push Changes**
   - Click "Push" button in header
   - Enter commit message
   - Choose or create repository

3. **Clone Repository**
   - Click "Clone from GitHub" on welcome screen
   - Enter repository URL and branch

### Deployment

1. **Connect GitHub** (required first)
2. **Push your project** to GitHub
3. Click **"Deploy"** button in header
4. Choose provider:
   - **Vercel**: Best for Next.js apps
   - **Netlify**: Great for static sites
   - **Cloudflare Pages**: Fast global CDN
5. Follow provider's import flow

### Multi-Agent System

DevForge automatically routes your requests to specialized agents:

- **🏗️ Architect**: Plans structure for new projects
- **⚡ Coder**: Fast implementation of features
- **🔧 Debugger**: Analyzes and fixes errors
- **🎨 Designer**: UI/UX focused implementation
- **✓ Tester**: Generates tests and ensures quality

The active agent is shown as a badge during generation.

### Diff View

1. Go to **Settings** → Enable "Show diff before applying changes"
2. AI changes will show in a diff modal
3. Review, accept/reject per file
4. Click "Apply Changes"

### Design Mode (Experimental)

1. Click the **Palette icon** in the header
2. Design mode is now active
3. Click elements in preview to inspect styles
4. Adjust colors, spacing, etc. (AI-assisted)

---

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Monaco Editor** - VSCode editor component
- **Zustand** - State management

### AI & Tools
- **OpenRouter** - Multi-model AI API access
- **WebContainers** - Browser-based Node.js runtime
- **xterm.js** - Terminal emulator
- **Octokit** - GitHub API client
- **react-diff-viewer** - Code diff UI

### Free Models Available
- DeepSeek V3 (Best for code)
- Llama 4 Scout & Maverick
- Gemini 2.0 Flash (Vision + 1M context)
- QwQ 32B (Reasoning)

---

## 📁 Project Structure

```
devforge/
├── app/                      # Next.js app directory
│   ├── api/chat/            # AI chat API route
│   └── page.tsx             # Main app page
├── components/              # React components
│   ├── ChatPanel.tsx        # AI chat interface
│   ├── EditorPanel.tsx      # Code editor
│   ├── PreviewPanel.tsx     # Live preview
│   ├── TerminalPanel.tsx    # Terminal
│   ├── WorkspaceLayout.tsx  # Main layout
│   ├── TemplateGallery.tsx  # Template browser
│   ├── DiffViewer.tsx       # Code diff viewer
│   ├── GitHubCommitDialog.tsx
│   ├── DeployModal.tsx
│   └── StyleInspector.tsx
├── lib/                     # Core logic
│   ├── agents/             # Multi-agent system
│   │   ├── types.ts
│   │   ├── router.ts
│   │   ├── index.ts
│   │   └── prompts/        # Agent-specific prompts
│   ├── templates/          # Project templates
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── definitions/
│   ├── store.ts            # Zustand store
│   ├── fileSystem.ts       # WebContainer interface
│   ├── github.ts           # GitHub API client
│   ├── deploy.ts           # Deployment utilities
│   ├── streamParser.ts     # AI response parser
│   ├── systemPrompt.ts     # Base AI prompt
│   └── db.ts               # IndexedDB storage
├── hooks/
│   ├── useChat.ts          # Chat logic
│   └── useWebContainer.ts  # WebContainer hook
└── public/                 # Static assets
```

---

## 🔑 Configuration

### API Keys

#### OpenRouter (Required for AI)
1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Create a new API key
3. Add to Settings in DevForge UI or `.env.local`:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

#### GitHub (Optional)
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Generate token with `repo` scope
3. Add via "Connect GitHub" button in UI

### Environment Variables

```bash
# Optional - can also add via UI
OPENROUTER_API_KEY=your_openrouter_key

# GitHub OAuth (for future OAuth flow)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# App URL for deployment
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 🎯 Roadmap

### ✅ Completed
- [x] Core AI code generation
- [x] WebContainer integration
- [x] Multi-file editing
- [x] Template system
- [x] Diff view
- [x] Screenshot-to-code
- [x] GitHub integration
- [x] Deployment integration
- [x] Component regeneration
- [x] Multi-agent architecture
- [x] Visual design mode (MVP)

### 🚧 Planned
- [ ] Real-time collaboration
- [ ] GitHub OAuth flow
- [ ] Custom templates
- [ ] Plugin system
- [ ] Advanced design mode
- [ ] Component library
- [ ] AI code review
- [ ] Performance profiling

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [WebContainers](https://webcontainers.io/) by StackBlitz
- [OpenRouter](https://openrouter.ai/) for multi-model AI access
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) by Microsoft
- [Bolt.new](https://bolt.new/), [Lovable](https://lovable.dev/), and [v0.dev](https://v0.dev/) for inspiration.

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/devforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/devforge/discussions)
.
---

**Built with ❤️ by the open-source community**

⭐ Star this repo if you find it useful!
