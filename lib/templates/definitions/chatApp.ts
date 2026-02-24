import { Template } from '../schema';

export const chatAppTemplate: Template = {
  id: 'chat-app',
  name: 'Chat Application',
  description: 'Messaging app with contacts sidebar, chat bubbles, and simulated replies',
  category: 'tool',
  thumbnail: '💬',
  tags: ['chat', 'messaging', 'realtime', 'social'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'chat-app',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.344.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' },
    }, null, 2),
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>ChatWave</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`,
    'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
    'src/index.css': `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e4e4e7; }`,
    'src/App.jsx': `import { useState, useRef, useEffect } from 'react';
import { Send, Search, Phone, Video, MoreVertical } from 'lucide-react';
import './App.css';

const CONTACTS = [
  { id: 1, name: 'Alice Chen', avatar: '👩‍💻', status: 'online', lastMsg: 'That sounds great!' },
  { id: 2, name: 'Bob Smith', avatar: '👨‍🎨', status: 'online', lastMsg: 'Check the latest design' },
  { id: 3, name: 'Carol Davis', avatar: '👩‍🔬', status: 'away', lastMsg: 'Meeting at 3pm?' },
  { id: 4, name: 'Dan Wilson', avatar: '👨‍💼', status: 'offline', lastMsg: 'Thanks for the update' },
  { id: 5, name: 'Eve Martinez', avatar: '👩‍🚀', status: 'online', lastMsg: 'Deployed to production!' },
];

const AUTO_REPLIES = [
  'That sounds great! Let me look into it.',
  'Sure, I can help with that.',
  'Interesting approach! What do you think about...?',
  'Got it, I will update the docs.',
  'Nice! Let me know if you need anything else.',
  'Hmm, let me think about that for a moment.',
];

const INITIAL_MESSAGES = {
  1: [
    { id: 1, sender: 'them', text: 'Hey! How is the new feature going?', time: '10:30 AM' },
    { id: 2, sender: 'me', text: 'Going well! Almost done with the UI.', time: '10:32 AM' },
    { id: 3, sender: 'them', text: 'That sounds great!', time: '10:33 AM' },
  ],
  2: [
    { id: 1, sender: 'them', text: 'Check the latest design mockups I sent', time: '9:15 AM' },
    { id: 2, sender: 'me', text: 'Will do! Looking now.', time: '9:20 AM' },
  ],
};

export default function App() {
  const [activeContact, setActiveContact] = useState(CONTACTS[0]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  const currentMessages = messages[activeContact.id] || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMsg = { id: Date.now(), sender: 'me', text: input.trim(), time };

    setMessages(prev => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newMsg],
    }));
    setInput('');

    // Simulate reply after 1-2 seconds
    setTimeout(() => {
      const reply = AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)];
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => ({
        ...prev,
        [activeContact.id]: [...(prev[activeContact.id] || []), { id: Date.now(), sender: 'them', text: reply, time: replyTime }],
      }));
    }, 1000 + Math.random() * 1000);
  };

  const filteredContacts = CONTACTS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="chat-app">
      {/* Contacts sidebar */}
      <div className="contacts">
        <div className="contacts-header">
          <h2>Messages</h2>
        </div>
        <div className="contacts-search">
          <Search size={16} />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="contact-list">
          {filteredContacts.map(contact => (
            <div key={contact.id} className={\`contact-item \${activeContact.id === contact.id ? 'active' : ''}\`} onClick={() => setActiveContact(contact)}>
              <div className="avatar-wrap">
                <span className="avatar">{contact.avatar}</span>
                <span className={\`status-dot \${contact.status}\`} />
              </div>
              <div className="contact-info">
                <div className="contact-name">{contact.name}</div>
                <div className="contact-preview">{contact.lastMsg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-area">
        <div className="chat-header">
          <div className="chat-header-info">
            <span className="avatar">{activeContact.avatar}</span>
            <div>
              <div className="chat-header-name">{activeContact.name}</div>
              <div className="chat-header-status">{activeContact.status}</div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button><Phone size={18} /></button>
            <button><Video size={18} /></button>
            <button><MoreVertical size={18} /></button>
          </div>
        </div>

        <div className="messages">
          {currentMessages.map(msg => (
            <div key={msg.id} className={\`message \${msg.sender}\`}>
              <div className="bubble">{msg.text}</div>
              <div className="msg-time">{msg.time}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-bar">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}`,
    'src/App.css': `.chat-app { display: flex; height: 100vh; }

.contacts { width: 320px; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; background: #0c0c12; }
.contacts-header { padding: 20px; }
.contacts-header h2 { font-size: 20px; font-weight: 700; }
.contacts-search { display: flex; align-items: center; gap: 8px; margin: 0 16px 12px; padding: 10px 12px; border-radius: 10px; background: rgba(255,255,255,0.04); color: #71717a; }
.contacts-search input { flex: 1; background: none; border: none; outline: none; color: #e4e4e7; font-size: 14px; font-family: inherit; }
.contacts-search input::placeholder { color: #52525b; }
.contact-list { flex: 1; overflow-y: auto; }
.contact-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.15s; }
.contact-item:hover { background: rgba(255,255,255,0.04); }
.contact-item.active { background: rgba(139,92,246,0.08); }
.avatar-wrap { position: relative; }
.avatar { font-size: 32px; }
.status-dot { position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; border-radius: 50%; border: 2px solid #0c0c12; }
.status-dot.online { background: #22c55e; }
.status-dot.away { background: #eab308; }
.status-dot.offline { background: #52525b; }
.contact-info { flex: 1; min-width: 0; }
.contact-name { font-size: 14px; font-weight: 600; }
.contact-preview { font-size: 13px; color: #52525b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.chat-area { flex: 1; display: flex; flex-direction: column; }
.chat-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(10,10,15,0.9); }
.chat-header-info { display: flex; align-items: center; gap: 12px; }
.chat-header-info .avatar { font-size: 28px; }
.chat-header-name { font-size: 15px; font-weight: 600; }
.chat-header-status { font-size: 12px; color: #52525b; }
.chat-header-actions { display: flex; gap: 4px; }
.chat-header-actions button { background: none; border: none; color: #71717a; padding: 8px; border-radius: 8px; cursor: pointer; transition: all 0.15s; }
.chat-header-actions button:hover { background: rgba(255,255,255,0.06); color: #e4e4e7; }

.messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.message { display: flex; flex-direction: column; max-width: 70%; }
.message.me { align-self: flex-end; align-items: flex-end; }
.message.them { align-self: flex-start; align-items: flex-start; }
.bubble { padding: 10px 16px; border-radius: 18px; font-size: 14px; line-height: 1.5; }
.message.me .bubble { background: #8b5cf6; color: white; border-bottom-right-radius: 4px; }
.message.them .bubble { background: rgba(255,255,255,0.06); border-bottom-left-radius: 4px; }
.msg-time { font-size: 11px; color: #52525b; margin-top: 2px; padding: 0 4px; }

.input-bar { display: flex; gap: 12px; padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.06); background: #0c0c12; }
.input-bar input { flex: 1; padding: 12px 16px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); color: #e4e4e7; font-size: 14px; outline: none; font-family: inherit; }
.input-bar input:focus { border-color: rgba(139,92,246,0.3); }
.input-bar input::placeholder { color: #52525b; }
.send-btn { padding: 12px; border-radius: 12px; background: #8b5cf6; color: white; border: none; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; }
.send-btn:hover { opacity: 0.9; }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }`,
  },
};
