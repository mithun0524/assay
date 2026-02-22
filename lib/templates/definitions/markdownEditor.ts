import { Template } from '../schema';

export const markdownEditorTemplate: Template = {
  id: 'markdown-editor',
  name: 'Markdown Editor',
  description: 'Live markdown editor with split-pane preview',
  category: 'tool',
  thumbnail: '📝',
  tags: ['markdown', 'editor', 'notes', 'writing'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'marked': '^12.0.0',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'markdown-editor',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        marked: '^12.0.0',
        'lucide-react': '^0.344.0',
      },
      devDependencies: {
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        '@vitejs/plugin-react': '^4.3.4',
        vite: '^5.4.11',
      },
    }, null, 2),

    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Markdown Editor</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

    'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`,

    'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

    'src/App.jsx': `import { useState, useEffect } from 'react';
import { marked } from 'marked';
import { FileText, Eye, Download, Upload } from 'lucide-react';
import './App.css';

const DEFAULT_MARKDOWN = \`# Welcome to Markdown Editor

## Features
- **Live Preview**: See your markdown rendered in real-time
- **Split View**: Editor and preview side by side
- **Download**: Export your work as .md file
- **Import**: Load existing markdown files

## How to Use
Start typing in the left panel and see the preview on the right!

### Code Blocks
\\\`\\\`\\\`javascript
const hello = () => {
  console.log('Hello World!');
};
\\\`\\\`\\\`

### Lists
- Item 1
- Item 2
  - Nested item

### Links
[Visit Example](https://example.com)

### Images
![Alt text](https://via.placeholder.com/400x200)

---

**Happy writing!**
\`;

function App() {
  const [markdown, setMarkdown] = useState(() => {
    return localStorage.getItem('markdown-content') || DEFAULT_MARKDOWN;
  });
  const [html, setHtml] = useState('');

  useEffect(() => {
    const rendered = marked(markdown);
    setHtml(rendered);
    localStorage.setItem('markdown-content', markdown);
  }, [markdown]);

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setMarkdown(e.target?.result || '');
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <FileText size={24} />
          <h1>Markdown Editor</h1>
        </div>
        <div className="header-actions">
          <label className="upload-btn">
            <Upload size={18} />
            Import
            <input type="file" accept=".md,.markdown" onChange={handleUpload} hidden />
          </label>
          <button onClick={handleDownload}>
            <Download size={18} />
            Export
          </button>
        </div>
      </header>

      <div className="editor-container">
        <div className="editor-pane">
          <div className="pane-header">
            <FileText size={16} />
            <span>Markdown</span>
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Type your markdown here..."
            spellCheck="false"
          />
        </div>

        <div className="preview-pane">
          <div className="pane-header">
            <Eye size={16} />
            <span>Preview</span>
          </div>
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;`,

    'src/index.css': `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
  height: 100vh;
  overflow: hidden;
}

#root {
  height: 100vh;
}`,

    'src/App.css': `.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: #1e293b;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-left svg {
  color: #8b5cf6;
}

header h1 {
  font-size: 1.25rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.header-actions button,
.upload-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.header-actions button:hover,
.upload-btn:hover {
  background: #334155;
  border-color: #475569;
}

.editor-container {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  overflow: hidden;
}

.editor-pane,
.preview-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-pane {
  border-right: 1px solid #334155;
  background: #1e293b;
}

.preview-pane {
  background: #0f172a;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  font-size: 0.875rem;
  font-weight: 500;
  color: #94a3b8;
}

.pane-header svg {
  color: #8b5cf6;
}

textarea {
  flex: 1;
  padding: 1.5rem;
  border: none;
  background: transparent;
  color: #e2e8f0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.95rem;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.preview-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  line-height: 1.7;
}

.preview-content h1,
.preview-content h2,
.preview-content h3,
.preview-content h4,
.preview-content h5,
.preview-content h6 {
  margin: 1.5rem 0 1rem;
  font-weight: 600;
  color: #f1f5f9;
}

.preview-content h1 {
  font-size: 2rem;
  border-bottom: 2px solid #334155;
  padding-bottom: 0.5rem;
}

.preview-content h2 {
  font-size: 1.5rem;
}

.preview-content h3 {
  font-size: 1.25rem;
}

.preview-content p {
  margin: 1rem 0;
}

.preview-content code {
  background: #1e293b;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.875em;
  color: #f472b6;
}

.preview-content pre {
  background: #1e293b;
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
}

.preview-content pre code {
  background: none;
  padding: 0;
  color: #e2e8f0;
}

.preview-content ul,
.preview-content ol {
  margin: 1rem 0;
  padding-left: 2rem;
}

.preview-content li {
  margin: 0.5rem 0;
}

.preview-content a {
  color: #8b5cf6;
  text-decoration: none;
}

.preview-content a:hover {
  text-decoration: underline;
}

.preview-content img {
  max-width: 100%;
  border-radius: 8px;
  margin: 1rem 0;
}

.preview-content blockquote {
  border-left: 4px solid #8b5cf6;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #94a3b8;
}

.preview-content hr {
  border: none;
  border-top: 1px solid #334155;
  margin: 2rem 0;
}

.preview-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.preview-content th,
.preview-content td {
  border: 1px solid #334155;
  padding: 0.75rem;
  text-align: left;
}

.preview-content th {
  background: #1e293b;
  font-weight: 600;
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }

  .editor-pane {
    border-right: none;
    border-bottom: 1px solid #334155;
  }
}`,
  },
};
