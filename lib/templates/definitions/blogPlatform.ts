import { Template } from '../schema';

export const blogPlatformTemplate: Template = {
  id: 'blog-platform',
  name: 'Blog Platform',
  description: 'Clean blog with post list, reading view, categories, and search',
  category: 'blog',
  thumbnail: '📝',
  tags: ['blog', 'content', 'writing', 'articles'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'blog-platform',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.344.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' },
    }, null, 2),
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>DevBlog</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`,
    'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
    'src/index.css': `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Georgia', serif; background: #0f0f13; color: #d4d4d8; line-height: 1.8; }
a { color: inherit; text-decoration: none; }`,
    'src/App.jsx': `import { useState } from 'react';
import { ArrowLeft, Search, Calendar, Clock, Tag } from 'lucide-react';
import './App.css';

const POSTS = [
  { id: 1, title: 'Getting Started with React Server Components', excerpt: 'A deep dive into the future of React rendering, exploring how Server Components change the way we think about data fetching and component architecture.', date: '2024-03-15', readTime: '8 min', category: 'React', content: 'React Server Components represent a paradigm shift in how we build React applications. Unlike traditional client-side rendering or even server-side rendering, RSCs allow you to run components entirely on the server while maintaining the interactivity of client-side React.\\n\\nThe key benefits include:\\n\\n1. **Zero bundle size** - Server Components never ship JavaScript to the client\\n2. **Direct data access** - Query databases directly without API layers\\n3. **Automatic code splitting** - Only client components are bundled\\n\\nTo get started, you need to understand the distinction between Server and Client components. By default, all components in the App Router are Server Components. To make a component interactive, add the "use client" directive at the top of the file.' },
  { id: 2, title: 'Building Type-Safe APIs with tRPC', excerpt: 'Learn how to create end-to-end type-safe APIs without code generation, schemas, or extra build steps.', date: '2024-03-10', readTime: '6 min', category: 'TypeScript', content: 'tRPC allows you to build fully type-safe APIs without schemas or code generation. It leverages TypeScript\\'s type inference to give you autocomplete and type checking from your backend to your frontend.\\n\\nThe setup is straightforward:\\n\\n1. Define your router with procedures\\n2. Create a tRPC client\\n3. Use the client in your React components\\n\\nThe magic happens because TypeScript can infer the input and output types of each procedure, giving you full type safety across the network boundary.' },
  { id: 3, title: 'CSS Container Queries: A Complete Guide', excerpt: 'Container queries let components respond to their container size, not just the viewport. Here\\'s everything you need to know.', date: '2024-03-05', readTime: '5 min', category: 'CSS', content: 'Container queries are one of the most requested CSS features, finally available in all major browsers. They allow components to adapt their styling based on the size of their container rather than the viewport.\\n\\nThis is revolutionary for component-based design because a card component can now look different in a sidebar versus a main content area, without any JavaScript.\\n\\nKey concepts:\\n\\n- container-type: defines an element as a query container\\n- @container: the at-rule for writing container queries\\n- container-name: allows targeting specific containers' },
  { id: 4, title: 'The State of JavaScript Bundlers in 2024', excerpt: 'Comparing Vite, Turbopack, Rspack, and esbuild — which bundler should you choose for your next project?', date: '2024-02-28', readTime: '10 min', category: 'Tooling', content: 'The JavaScript bundler landscape has evolved dramatically. Here\\'s a comparison of the top options:\\n\\n**Vite** - The most popular choice, using esbuild for dev and Rollup for production. Excellent DX with instant HMR.\\n\\n**Turbopack** - Vercel\\'s Rust-based bundler, designed as the successor to Webpack. Still in beta but showing promising benchmarks.\\n\\n**Rspack** - A Rust-based Webpack-compatible bundler. Great for migrating existing Webpack projects.\\n\\n**esbuild** - The fastest bundler, written in Go. Best for libraries and simple applications.' },
];

const CATEGORIES = ['All', ...new Set(POSTS.map(p => p.category))];

export default function App() {
  const [selectedPost, setSelectedPost] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = POSTS.filter(p => {
    const matchesSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (selectedPost) {
    return (
      <div className="app">
        <nav className="nav"><div className="nav-inner"><div className="logo">DevBlog</div></div></nav>
        <article className="post-detail">
          <button className="back-btn" onClick={() => setSelectedPost(null)}><ArrowLeft size={18} /> Back to posts</button>
          <div className="post-meta-detail">
            <span className="category-tag">{selectedPost.category}</span>
            <span><Calendar size={14} /> {selectedPost.date}</span>
            <span><Clock size={14} /> {selectedPost.readTime} read</span>
          </div>
          <h1>{selectedPost.title}</h1>
          {selectedPost.content.split('\\n\\n').map((p, i) => <p key={i} className="post-paragraph">{p}</p>)}
        </article>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav"><div className="nav-inner"><div className="logo">DevBlog</div></div></nav>
      <div className="layout">
        <main className="main">
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Search articles..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="post-list">
            {filtered.map(post => (
              <article key={post.id} className="post-card" onClick={() => setSelectedPost(post)}>
                <div className="post-meta">
                  <span className="category-tag">{post.category}</span>
                  <span><Calendar size={14} /> {post.date}</span>
                  <span><Clock size={14} /> {post.readTime}</span>
                </div>
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
              </article>
            ))}
            {filtered.length === 0 && <p className="empty">No articles found.</p>}
          </div>
        </main>
        <aside className="sidebar">
          <div className="sidebar-section">
            <h3>Categories</h3>
            {CATEGORIES.map(cat => (
              <button key={cat} className={\`cat-btn \${activeCategory === cat ? 'active' : ''}\`} onClick={() => setActiveCategory(cat)}>
                <Tag size={14} /> {cat}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}`,
    'src/App.css': `.app { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
.nav { border-bottom: 1px solid rgba(255,255,255,0.06); }
.nav-inner { padding: 16px 0; }
.logo { font-size: 22px; font-weight: 700; font-family: -apple-system, sans-serif; }

.layout { display: grid; grid-template-columns: 1fr 260px; gap: 40px; padding: 40px 0; }
.main { min-width: 0; }

.search-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 32px; color: #71717a; }
.search-bar input { flex: 1; background: none; border: none; outline: none; color: #e4e4e7; font-size: 15px; font-family: inherit; }
.search-bar input::placeholder { color: #52525b; }

.post-list { display: flex; flex-direction: column; gap: 24px; }
.post-card { padding: 24px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: all 0.2s; }
.post-card:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); }
.post-card h2 { font-size: 20px; margin: 12px 0 8px; font-family: -apple-system, sans-serif; color: #fafafa; }
.post-card p { font-size: 15px; color: #71717a; }

.post-meta, .post-meta-detail { display: flex; align-items: center; gap: 16px; font-size: 13px; color: #52525b; }
.post-meta span, .post-meta-detail span { display: flex; align-items: center; gap: 4px; }
.category-tag { background: rgba(139,92,246,0.1); color: #8b5cf6; padding: 2px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: -apple-system, sans-serif; }

.sidebar-section { padding: 20px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
.sidebar-section h3 { font-size: 14px; font-family: -apple-system, sans-serif; margin-bottom: 12px; color: #a1a1aa; }
.cat-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: none; background: none; color: #71717a; font-size: 14px; border-radius: 8px; cursor: pointer; transition: all 0.15s; text-align: left; font-family: inherit; }
.cat-btn:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }
.cat-btn.active { background: rgba(139,92,246,0.1); color: #8b5cf6; }

.post-detail { max-width: 720px; margin: 0 auto; padding: 40px 0; }
.back-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; color: #8b5cf6; font-size: 14px; cursor: pointer; margin-bottom: 24px; font-family: inherit; }
.back-btn:hover { opacity: 0.8; }
.post-detail h1 { font-size: 36px; font-family: -apple-system, sans-serif; margin: 16px 0 32px; color: #fafafa; line-height: 1.3; }
.post-paragraph { margin-bottom: 20px; font-size: 17px; color: #a1a1aa; }
.empty { text-align: center; color: #52525b; padding: 40px; }`,
  },
};
