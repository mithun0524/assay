import { Template } from '../schema';

export const taskManagerTemplate: Template = {
  id: 'task-manager',
  name: 'Task Manager',
  description: 'Kanban board with drag-and-drop task management',
  category: 'tool',
  thumbnail: '📋',
  tags: ['kanban', 'productivity', 'drag-drop', 'tasks'],
  framework: 'vite',
  startCommand: 'npm run dev',
  dependencies: {
    'react': '^18.3.1',
    'react-dom': '^18.3.1',
    'lucide-react': '^0.344.0',
  },
  files: {
    'package.json': JSON.stringify({
      name: 'task-manager',
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
    <title>Task Manager</title>
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

    'src/App.jsx': `import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import './App.css';

function App() {
  const [columns, setColumns] = useState({
    todo: { name: 'To Do', tasks: [] },
    inProgress: { name: 'In Progress', tasks: [] },
    done: { name: 'Done', tasks: [] },
  });
  const [newTask, setNewTask] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);

  const addTask = (columnId) => {
    if (!newTask.trim()) return;
    setColumns({
      ...columns,
      [columnId]: {
        ...columns[columnId],
        tasks: [...columns[columnId].tasks, { id: Date.now(), text: newTask }],
      },
    });
    setNewTask('');
  };

  const deleteTask = (columnId, taskId) => {
    setColumns({
      ...columns,
      [columnId]: {
        ...columns[columnId],
        tasks: columns[columnId].tasks.filter((t) => t.id !== taskId),
      },
    });
  };

  const handleDragStart = (e, task, sourceColumn) => {
    setDraggedTask({ task, sourceColumn });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetColumn) => {
    e.preventDefault();
    if (!draggedTask) return;

    const { task, sourceColumn } = draggedTask;
    if (sourceColumn === targetColumn) {
      setDraggedTask(null);
      return;
    }

    // Remove from source
    const newColumns = { ...columns };
    newColumns[sourceColumn] = {
      ...newColumns[sourceColumn],
      tasks: newColumns[sourceColumn].tasks.filter((t) => t.id !== task.id),
    };

    // Add to target
    newColumns[targetColumn] = {
      ...newColumns[targetColumn],
      tasks: [...newColumns[targetColumn].tasks, task],
    };

    setColumns(newColumns);
    setDraggedTask(null);
  };

  return (
    <div className="app">
      <header>
        <h1>Task Manager</h1>
        <p>Organize your work with a simple Kanban board</p>
      </header>

      <div className="add-task">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTask('todo')}
        />
        <button onClick={() => addTask('todo')}>
          <Plus size={20} />
          Add Task
        </button>
      </div>

      <div className="board">
        {Object.entries(columns).map(([colId, column]) => (
          <div
            key={colId}
            className="column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, colId)}
          >
            <div className="column-header">
              <h2>{column.name}</h2>
              <span className="task-count">{column.tasks.length}</span>
            </div>
            <div className="tasks">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  className="task"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task, colId)}
                >
                  <GripVertical size={16} className="grip" />
                  <span className="task-text">{task.text}</span>
                  <button
                    className="delete-btn"
                    onClick={() => deleteTask(colId, task.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {column.tasks.length === 0 && (
                <div className="empty-state">No tasks yet</div>
              )}
            </div>
          </div>
        ))}
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
  color: #1a202c;
}

#root {
  min-height: 100vh;
}`,

    'src/App.css': `.app {
  min-height: 100vh;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
  color: white;
}

header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

header p {
  font-size: 1rem;
  opacity: 0.9;
}

.add-task {
  max-width: 600px;
  margin: 0 auto 2rem;
  display: flex;
  gap: 0.75rem;
}

.add-task input {
  flex: 1;
  padding: 0.875rem 1rem;
  border: none;
  border-radius: 12px;
  font-size: 0.95rem;
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.add-task input:focus {
  outline: 2px solid #667eea;
}

.add-task button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  border: none;
  border-radius: 12px;
  background: #667eea;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.add-task button:hover {
  background: #5568d3;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
}

.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.column {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  min-height: 400px;
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
}

.column-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
}

.task-count {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
}

.tasks {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.task {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: move;
  transition: all 0.2s;
}

.task:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  transform: translateY(-2px);
}

.grip {
  color: #cbd5e0;
  flex-shrink: 0;
}

.task-text {
  flex: 1;
  font-size: 0.95rem;
}

.delete-btn {
  background: none;
  border: none;
  color: #e53e3e;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
}

.task:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #fff5f5;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: #a0aec0;
  font-size: 0.95rem;
}`,
  },
};
