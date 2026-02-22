import { Template } from '../schema';

export const portfolioTemplate: Template = {
  id: 'portfolio',
  name: 'Portfolio Landing Page',
  description: 'Modern portfolio with smooth animations',
  category: 'landing',
  thumbnail: '💼',
  tags: ['portfolio', 'landing', 'responsive', 'personal'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'portfolio',
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
    <title>Portfolio</title>
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

    'src/App.jsx': `import { Github, Linkedin, Mail, ExternalLink, Code2, Palette, Zap } from 'lucide-react';
import './App.css';

const projects = [
  {
    title: 'AI Chat Application',
    description: 'Real-time chat app with AI-powered responses',
    tags: ['React', 'Node.js', 'OpenAI'],
    link: '#',
  },
  {
    title: 'E-commerce Platform',
    description: 'Full-stack online store with payment integration',
    tags: ['Next.js', 'Stripe', 'MongoDB'],
    link: '#',
  },
  {
    title: 'Task Management Tool',
    description: 'Kanban board with drag-and-drop functionality',
    tags: ['React', 'TypeScript', 'Tailwind'],
    link: '#',
  },
];

const skills = [
  { name: 'Frontend Development', icon: Code2, color: '#667eea' },
  { name: 'UI/UX Design', icon: Palette, color: '#f59e0b' },
  { name: 'Performance Optimization', icon: Zap, color: '#10b981' },
];

function App() {
  return (
    <div className="app">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="avatar">JD</div>
          <h1 className="name">Jane Doe</h1>
          <p className="title">Full Stack Developer</p>
          <p className="bio">
            Building beautiful, performant web applications with modern technologies.
            Passionate about clean code and great user experiences.
          </p>
          <div className="social-links">
            <a href="#" aria-label="GitHub">
              <Github size={20} />
            </a>
            <a href="#" aria-label="LinkedIn">
              <Linkedin size={20} />
            </a>
            <a href="mailto:hello@example.com" aria-label="Email">
              <Mail size={20} />
            </a>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section className="skills">
        <div className="container">
          <h2>What I Do</h2>
          <div className="skills-grid">
            {skills.map((skill) => (
              <div key={skill.name} className="skill-card">
                <div className="skill-icon" style={{ background: \`\${skill.color}20\` }}>
                  <skill.icon size={32} style={{ color: skill.color }} />
                </div>
                <h3>{skill.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="projects">
        <div className="container">
          <h2>Featured Projects</h2>
          <div className="projects-grid">
            {projects.map((project) => (
              <div key={project.title} className="project-card">
                <div className="project-header">
                  <h3>{project.title}</h3>
                  <a href={project.link} className="project-link">
                    <ExternalLink size={18} />
                  </a>
                </div>
                <p className="project-description">{project.description}</p>
                <div className="project-tags">
                  {project.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="contact">
        <div className="container">
          <h2>Get In Touch</h2>
          <p className="contact-text">
            I'm always open to discussing new projects, creative ideas, or opportunities.
          </p>
          <a href="mailto:hello@example.com" className="contact-btn">
            <Mail size={20} />
            Send me an email
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <p>© 2024 Jane Doe. All rights reserved.</p>
      </footer>
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
  line-height: 1.6;
}

#root {
  min-height: 100vh;
}`,

    'src/App.css': `.app {
  min-height: 100vh;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Hero Section */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  opacity: 0.3;
}

.hero-content {
  position: relative;
  z-index: 1;
  animation: fadeInUp 1s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: white;
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: 700;
  margin: 0 auto 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.name {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: white;
}

.title {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.bio {
  font-size: 1.125rem;
  max-width: 600px;
  margin: 0 auto 2rem;
  color: rgba(255, 255, 255, 0.85);
}

.social-links {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.social-links a {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-decoration: none;
  transition: all 0.3s;
}

.social-links a:hover {
  background: white;
  color: #667eea;
  transform: translateY(-4px);
}

/* Skills Section */
.skills {
  padding: 6rem 0;
  background: #1e293b;
}

h2 {
  font-size: 2.5rem;
  text-align: center;
  margin-bottom: 3rem;
  color: white;
}

.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.skill-card {
  background: #0f172a;
  padding: 2rem;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s;
  border: 1px solid #334155;
}

.skill-card:hover {
  transform: translateY(-8px);
  border-color: #667eea;
}

.skill-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}

.skill-card h3 {
  font-size: 1.25rem;
  color: #f1f5f9;
}

/* Projects Section */
.projects {
  padding: 6rem 0;
  background: #0f172a;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2rem;
}

.project-card {
  background: #1e293b;
  padding: 2rem;
  border-radius: 16px;
  border: 1px solid #334155;
  transition: all 0.3s;
}

.project-card:hover {
  border-color: #667eea;
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.2);
}

.project-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.project-header h3 {
  font-size: 1.25rem;
  color: white;
  margin: 0;
}

.project-link {
  color: #667eea;
  transition: all 0.2s;
}

.project-link:hover {
  transform: scale(1.1);
}

.project-description {
  color: #94a3b8;
  margin-bottom: 1.5rem;
}

.project-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tag {
  background: rgba(102, 126, 234, 0.1);
  color: #a5b4fc;
  padding: 0.375rem 0.75rem;
  border-radius: 8px;
  font-size: 0.875rem;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

/* Contact Section */
.contact {
  padding: 6rem 0;
  background: #1e293b;
  text-align: center;
}

.contact-text {
  font-size: 1.125rem;
  color: #94a3b8;
  max-width: 600px;
  margin: 0 auto 2rem;
}

.contact-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: #667eea;
  color: white;
  text-decoration: none;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s;
}

.contact-btn:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}

/* Footer */
footer {
  padding: 2rem;
  text-align: center;
  color: #64748b;
  background: #0f172a;
  border-top: 1px solid #1e293b;
}

@media (max-width: 768px) {
  .name {
    font-size: 2rem;
  }

  .title {
    font-size: 1.25rem;
  }

  h2 {
    font-size: 2rem;
  }
}`,
  },
};
