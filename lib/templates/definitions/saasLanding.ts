import { Template } from '../schema';

export const saasLandingTemplate: Template = {
  id: 'saas-landing',
  name: 'SaaS Landing Page',
  description: 'Modern SaaS landing page with hero, features, pricing, and CTA sections',
  category: 'saas',
  thumbnail: '🚀',
  tags: ['saas', 'landing', 'startup', 'pricing'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'saas-landing',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1',
        'lucide-react': '^0.344.0',
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.2.1',
        vite: '^5.1.4',
      },
    }, null, 2),
    'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LaunchPad - Ship Faster</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });`,
    'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
    'src/index.css': `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e4e4e7; line-height: 1.6; }
a { text-decoration: none; color: inherit; }`,
    'src/App.jsx': `import { Zap, Shield, BarChart3, Globe, ArrowRight, Check } from 'lucide-react';
import './App.css';

const features = [
  { icon: Zap, title: 'Lightning Fast', desc: 'Optimized for speed with edge computing and smart caching.' },
  { icon: Shield, title: 'Secure by Default', desc: 'Enterprise-grade security with end-to-end encryption.' },
  { icon: BarChart3, title: 'Real-time Analytics', desc: 'Track metrics and KPIs with live dashboards.' },
  { icon: Globe, title: 'Global Scale', desc: 'Deploy worldwide with automatic scaling and CDN.' },
];

const plans = [
  { name: 'Starter', price: 'Free', features: ['5 projects', '1GB storage', 'Community support', 'Basic analytics'], cta: 'Get Started' },
  { name: 'Pro', price: '$29', features: ['Unlimited projects', '100GB storage', 'Priority support', 'Advanced analytics', 'Custom domain', 'Team collaboration'], cta: 'Start Free Trial', popular: true },
  { name: 'Enterprise', price: '$99', features: ['Everything in Pro', '1TB storage', 'Dedicated support', 'SSO & SAML', 'SLA guarantee', 'Custom integrations'], cta: 'Contact Sales' },
];

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-inner">
          <div className="logo">LaunchPad</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <button className="btn btn-primary btn-sm">Get Started</button>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge">New: AI-powered workflows</div>
        <h1>Ship products<br /><span className="gradient-text">10x faster</span></h1>
        <p className="hero-sub">The all-in-one platform for modern teams. Build, deploy, and scale your apps with zero configuration.</p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg">Start Building <ArrowRight size={18} /></button>
          <button className="btn btn-ghost btn-lg">Watch Demo</button>
        </div>
        <p className="hero-note">Free forever. No credit card required.</p>
      </section>

      <section id="features" className="features">
        <h2>Everything you need</h2>
        <p className="section-sub">Powerful tools to help you build, deploy, and grow.</p>
        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon"><f.icon size={24} /></div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="pricing">
        <h2>Simple pricing</h2>
        <p className="section-sub">Choose the plan that fits your needs. Upgrade anytime.</p>
        <div className="pricing-grid">
          {plans.map((plan, i) => (
            <div key={i} className={\`pricing-card \${plan.popular ? 'popular' : ''}\`}>
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              <h3>{plan.name}</h3>
              <div className="price">{plan.price}<span>/mo</span></div>
              <ul>
                {plan.features.map((f, j) => (
                  <li key={j}><Check size={16} /> {f}</li>
                ))}
              </ul>
              <button className={\`btn \${plan.popular ? 'btn-primary' : 'btn-outline'} btn-full\`}>{plan.cta}</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <p>Built with LaunchPad. &copy; 2024</p>
      </footer>
    </div>
  );
}`,
    'src/App.css': `.app { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

.nav { position: sticky; top: 0; z-index: 50; background: rgba(10,10,15,0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.06); }
.nav-inner { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; }
.logo { font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.nav-links { display: flex; align-items: center; gap: 24px; }
.nav-links a { font-size: 14px; color: #a1a1aa; transition: color 0.2s; }
.nav-links a:hover { color: #e4e4e7; }

.btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; border: none; cursor: pointer; border-radius: 12px; transition: all 0.2s; font-size: 14px; }
.btn-sm { padding: 8px 16px; }
.btn-lg { padding: 14px 28px; font-size: 16px; }
.btn-full { width: 100%; justify-content: center; padding: 12px; }
.btn-primary { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
.btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
.btn-ghost { background: rgba(255,255,255,0.06); color: #e4e4e7; }
.btn-ghost:hover { background: rgba(255,255,255,0.1); }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #e4e4e7; }
.btn-outline:hover { background: rgba(255,255,255,0.06); }

.hero { text-align: center; padding: 120px 0 80px; }
.hero-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 13px; color: #8b5cf6; background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2); margin-bottom: 24px; }
.hero h1 { font-size: 64px; font-weight: 800; line-height: 1.1; margin-bottom: 20px; letter-spacing: -2px; }
.gradient-text { background: linear-gradient(135deg, #8b5cf6, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero-sub { font-size: 18px; color: #71717a; max-width: 560px; margin: 0 auto 32px; }
.hero-actions { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.hero-note { font-size: 13px; color: #52525b; }

.features, .pricing { padding: 80px 0; }
h2 { font-size: 36px; font-weight: 700; text-align: center; margin-bottom: 8px; }
.section-sub { text-align: center; color: #71717a; margin-bottom: 48px; }

.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; }
.feature-card { padding: 28px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); transition: all 0.2s; }
.feature-card:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); }
.feature-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(139,92,246,0.1); display: flex; align-items: center; justify-content: center; color: #8b5cf6; margin-bottom: 16px; }
.feature-card h3 { font-size: 16px; margin-bottom: 8px; }
.feature-card p { font-size: 14px; color: #71717a; }

.pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; max-width: 960px; margin: 0 auto; }
.pricing-card { padding: 32px; border-radius: 16px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); position: relative; }
.pricing-card.popular { border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.05); }
.popular-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; background: #8b5cf6; }
.pricing-card h3 { font-size: 18px; margin-bottom: 8px; }
.price { font-size: 40px; font-weight: 800; margin-bottom: 24px; }
.price span { font-size: 16px; font-weight: 400; color: #71717a; }
.pricing-card ul { list-style: none; margin-bottom: 24px; }
.pricing-card li { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #a1a1aa; padding: 6px 0; }
.pricing-card li svg { color: #8b5cf6; }

.footer { text-align: center; padding: 40px 0; border-top: 1px solid rgba(255,255,255,0.06); color: #52525b; font-size: 14px; }`,
  },
};
