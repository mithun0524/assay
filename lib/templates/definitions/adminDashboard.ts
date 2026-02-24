import { Template } from '../schema';

export const adminDashboardTemplate: Template = {
  id: 'admin-dashboard',
  name: 'Admin Dashboard',
  description: 'Analytics dashboard with stats, charts, sidebar nav, and activity table',
  category: 'dashboard',
  thumbnail: '📊',
  tags: ['admin', 'dashboard', 'analytics', 'charts'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'admin-dashboard',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.344.0' },
      devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.1.4' },
    }, null, 2),
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Dashboard</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
    'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });`,
    'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
    'src/index.css': `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e4e4e7; }`,
    'src/App.jsx': `import { useState } from 'react';
import { LayoutDashboard, Users, ShoppingBag, DollarSign, TrendingUp, TrendingDown, Activity, Settings, Bell, Search, BarChart3, Package } from 'lucide-react';
import './App.css';

const STATS = [
  { label: 'Total Revenue', value: '$45,231', change: '+20.1%', up: true, icon: DollarSign, color: '#22c55e' },
  { label: 'Active Users', value: '2,338', change: '+15.3%', up: true, icon: Users, color: '#8b5cf6' },
  { label: 'Orders', value: '1,234', change: '-3.2%', up: false, icon: ShoppingBag, color: '#f59e0b' },
  { label: 'Conversion', value: '3.24%', change: '+1.2%', up: true, icon: Activity, color: '#06b6d4' },
];

const CHART_DATA = [
  { month: 'Jan', value: 40 }, { month: 'Feb', value: 55 }, { month: 'Mar', value: 45 },
  { month: 'Apr', value: 70 }, { month: 'May', value: 65 }, { month: 'Jun', value: 80 },
  { month: 'Jul', value: 75 }, { month: 'Aug', value: 90 }, { month: 'Sep', value: 85 },
  { month: 'Oct', value: 95 }, { month: 'Nov', value: 88 }, { month: 'Dec', value: 100 },
];

const ACTIVITIES = [
  { user: 'Alice Chen', action: 'placed an order', item: '#1234', time: '2 min ago', avatar: '👩‍💻' },
  { user: 'Bob Smith', action: 'updated profile', item: '', time: '15 min ago', avatar: '👨‍🎨' },
  { user: 'Carol Davis', action: 'cancelled order', item: '#1201', time: '1 hour ago', avatar: '👩‍🔬' },
  { user: 'Dan Wilson', action: 'placed an order', item: '#1235', time: '2 hours ago', avatar: '👨‍💼' },
  { user: 'Eve Martinez', action: 'left a review', item: '5 stars', time: '3 hours ago', avatar: '👩‍🚀' },
  { user: 'Frank Lee', action: 'signed up', item: '', time: '5 hours ago', avatar: '👨‍🏫' },
];

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users, label: 'Customers' },
  { icon: Package, label: 'Products' },
  { icon: ShoppingBag, label: 'Orders' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
];

const maxValue = Math.max(...CHART_DATA.map(d => d.value));

export default function App() {
  const [activeNav, setActiveNav] = useState('Dashboard');

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">Admin</div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button key={item.label} className={\`nav-item \${activeNav === item.label ? 'active' : ''}\`} onClick={() => setActiveNav(item.label)}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="main">
        <header className="topbar">
          <div className="search-box">
            <Search size={18} />
            <input type="text" placeholder="Search..." />
          </div>
          <div className="topbar-actions">
            <button className="icon-btn"><Bell size={18} /></button>
            <div className="user-avatar">👤</div>
          </div>
        </header>

        <div className="content">
          <h1>Dashboard</h1>

          {/* Stats Grid */}
          <div className="stats-grid">
            {STATS.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-header">
                  <span className="stat-label">{stat.label}</span>
                  <div className="stat-icon" style={{ background: stat.color + '15', color: stat.color }}>
                    <stat.icon size={18} />
                  </div>
                </div>
                <div className="stat-value">{stat.value}</div>
                <div className={\`stat-change \${stat.up ? 'up' : 'down'}\`}>
                  {stat.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {stat.change} from last month
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="chart-card">
            <h2>Revenue Overview</h2>
            <div className="chart">
              {CHART_DATA.map((d, i) => (
                <div key={i} className="chart-col">
                  <div className="chart-bar-wrap">
                    <div className="chart-bar" style={{ height: \`\${(d.value / maxValue) * 100}%\` }} />
                  </div>
                  <span className="chart-label">{d.month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Table */}
          <div className="table-card">
            <h2>Recent Activity</h2>
            <table className="activity-table">
              <thead>
                <tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr>
              </thead>
              <tbody>
                {ACTIVITIES.map((a, i) => (
                  <tr key={i}>
                    <td><span className="table-avatar">{a.avatar}</span> {a.user}</td>
                    <td>{a.action}</td>
                    <td className="detail">{a.item || '—'}</td>
                    <td className="time">{a.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}`,
    'src/App.css': `.dashboard { display: flex; min-height: 100vh; }

.sidebar { width: 240px; background: #0c0c12; border-right: 1px solid rgba(255,255,255,0.06); padding: 20px 12px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
.sidebar-logo { font-size: 22px; font-weight: 800; padding: 0 12px 24px; background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.sidebar-nav { display: flex; flex-direction: column; gap: 4px; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: none; border: none; color: #71717a; font-size: 14px; cursor: pointer; transition: all 0.15s; font-family: inherit; text-align: left; }
.nav-item:hover { background: rgba(255,255,255,0.04); color: #e4e4e7; }
.nav-item.active { background: rgba(139,92,246,0.1); color: #8b5cf6; }

.main { flex: 1; min-width: 0; }
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 28px; border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; background: rgba(10,10,15,0.9); backdrop-filter: blur(12px); z-index: 10; }
.search-box { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px; background: rgba(255,255,255,0.04); color: #71717a; width: 280px; }
.search-box input { flex: 1; background: none; border: none; outline: none; color: #e4e4e7; font-size: 14px; font-family: inherit; }
.search-box input::placeholder { color: #52525b; }
.topbar-actions { display: flex; align-items: center; gap: 8px; }
.icon-btn { background: rgba(255,255,255,0.04); border: none; color: #71717a; padding: 8px; border-radius: 10px; cursor: pointer; }
.icon-btn:hover { background: rgba(255,255,255,0.08); color: #e4e4e7; }
.user-avatar { font-size: 24px; cursor: pointer; }

.content { padding: 28px; }
.content h1 { font-size: 24px; font-weight: 700; margin-bottom: 24px; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
.stat-card { padding: 20px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); }
.stat-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.stat-label { font-size: 13px; color: #71717a; }
.stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.stat-value { font-size: 28px; font-weight: 800; margin-bottom: 4px; }
.stat-change { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.stat-change.up { color: #22c55e; }
.stat-change.down { color: #ef4444; }

.chart-card, .table-card { padding: 24px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); margin-bottom: 24px; }
.chart-card h2, .table-card h2 { font-size: 16px; margin-bottom: 20px; }

.chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; }
.chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.chart-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.chart-bar { width: 100%; border-radius: 6px 6px 0 0; background: linear-gradient(180deg, #8b5cf6, rgba(139,92,246,0.3)); transition: height 0.3s ease; min-height: 4px; }
.chart-label { font-size: 11px; color: #52525b; }

.activity-table { width: 100%; border-collapse: collapse; }
.activity-table th { text-align: left; font-size: 12px; color: #52525b; font-weight: 500; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.activity-table td { font-size: 14px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.table-avatar { margin-right: 8px; }
.detail { color: #8b5cf6; }
.time { color: #52525b; font-size: 13px; }`,
  },
};
