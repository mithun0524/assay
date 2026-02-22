import { Template } from '../schema';

export const calculatorTemplate: Template = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Modern calculator with keyboard support',
  category: 'tool',
  thumbnail: '🧮',
  tags: ['calculator', 'math', 'utility'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'calculator',
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
    <title>Calculator</title>
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
import './App.css';

function App() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [newNumber, setNewNumber] = useState(true);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleNumber(e.key);
      } else if (e.key === '.') {
        handleNumber('.');
      } else if (['+', '-', '*', '/'].includes(e.key)) {
        handleOperation(e.key === '*' ? '×' : e.key === '/' ? '÷' : e.key);
      } else if (e.key === 'Enter' || e.key === '=') {
        handleEquals();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        handleClear();
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [display, previousValue, operation, newNumber]);

  const handleNumber = (num) => {
    if (num === '.' && display.includes('.')) return;
    if (newNumber) {
      setDisplay(num === '.' ? '0.' : num);
      setNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOperation = (op) => {
    const current = parseFloat(display);
    if (previousValue === null) {
      setPreviousValue(current);
    } else if (operation) {
      const result = calculate(previousValue, current, operation);
      setDisplay(String(result));
      setPreviousValue(result);
    }
    setOperation(op);
    setNewNumber(true);
  };

  const handleEquals = () => {
    if (previousValue !== null && operation) {
      const current = parseFloat(display);
      const result = calculate(previousValue, current, operation);
      setDisplay(String(result));
      setPreviousValue(null);
      setOperation(null);
      setNewNumber(true);
    }
  };

  const calculate = (a, b, op) => {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return a / b;
      default: return b;
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setNewNumber(true);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
      setNewNumber(true);
    }
  };

  const handlePercent = () => {
    setDisplay(String(parseFloat(display) / 100));
  };

  const handleToggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };

  return (
    <div className="app">
      <div className="calculator">
        <div className="display">
          {previousValue !== null && operation && (
            <div className="previous">{previousValue} {operation}</div>
          )}
          <div className="current">{display}</div>
        </div>
        <div className="buttons">
          <button onClick={handleClear} className="function">AC</button>
          <button onClick={handleToggleSign} className="function">±</button>
          <button onClick={handlePercent} className="function">%</button>
          <button onClick={() => handleOperation('÷')} className="operator">÷</button>

          <button onClick={() => handleNumber('7')}>7</button>
          <button onClick={() => handleNumber('8')}>8</button>
          <button onClick={() => handleNumber('9')}>9</button>
          <button onClick={() => handleOperation('×')} className="operator">×</button>

          <button onClick={() => handleNumber('4')}>4</button>
          <button onClick={() => handleNumber('5')}>5</button>
          <button onClick={() => handleNumber('6')}>6</button>
          <button onClick={() => handleOperation('−')} className="operator">−</button>

          <button onClick={() => handleNumber('1')}>1</button>
          <button onClick={() => handleNumber('2')}>2</button>
          <button onClick={() => handleNumber('3')}>3</button>
          <button onClick={() => handleOperation('+')} className="operator">+</button>

          <button onClick={() => handleNumber('0')} className="zero">0</button>
          <button onClick={() => handleNumber('.')}>.</button>
          <button onClick={handleEquals} className="operator">=</button>
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

#root {
  width: 100%;
}`,

    'src/App.css': `.app {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

.calculator {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 360px;
}

.display {
  background: #1a202c;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  text-align: right;
  min-height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.previous {
  font-size: 1.25rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.current {
  font-size: 2.5rem;
  font-weight: 300;
  color: white;
  word-wrap: break-word;
  word-break: break-all;
}

.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

button {
  border: none;
  border-radius: 12px;
  font-size: 1.5rem;
  font-weight: 500;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
  background: #f7fafc;
  color: #1a202c;
}

button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

button:active {
  transform: scale(0.98);
}

button.function {
  background: #e2e8f0;
  color: #1a202c;
}

button.operator {
  background: #667eea;
  color: white;
  font-size: 1.75rem;
}

button.zero {
  grid-column: span 2;
}

@media (max-width: 400px) {
  .calculator {
    max-width: 100%;
  }

  button {
    padding: 1.25rem;
    font-size: 1.25rem;
  }

  .current {
    font-size: 2rem;
  }
}`,
  },
};
