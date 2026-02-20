import { openDB, DBSchema } from 'idb';
import type { FileEntry, Message } from './store';

interface Project {
  id: string;
  name: string;
  lastModified: number;
  files: Record<string, FileEntry>;
  messages: Message[];
}

interface AIDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  meta: {
    key: string;
    value: string;
  };
}

const DB_NAME = 'ai-app-builder';
const DB_VERSION = 2;

async function getDb() {
  return openDB<AIDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (oldVersion < 1) {
        db.createObjectStore('projects', { keyPath: 'id' });
        db.createObjectStore('meta');
      } else if (oldVersion === 1) {
        // Migration from v1 to v2
        const store = transaction.objectStore('projects');
        // @ts-ignore - handling old schema manually
        store.getAll().then(async (data) => {
          // If we had old data (keys 'current' and 'messages'), migrate to a default project
          if (data && data.length > 0) {
            // @ts-ignore
            const files = (await store.get('current')) as any;
            // @ts-ignore
            const messages = (await store.get('messages')) as any;

            // Clear old store
            store.clear();

            // Create new store with keyPath
            db.deleteObjectStore('projects');
            const newStore = db.createObjectStore('projects', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('meta')) {
              db.createObjectStore('meta');
            }

            if (files || messages) {
              const defaultProject: Project = {
                id: 'default',
                name: 'My Project',
                lastModified: Date.now(),
                files: files || {},
                messages: messages || [],
              };
              newStore.put(defaultProject);
              transaction.objectStore('meta').put('default', 'activeProjectId');
            }
          } else {
            // No data, just recreate properly
            db.deleteObjectStore('projects');
            db.createObjectStore('projects', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('meta')) {
              db.createObjectStore('meta');
            }
          }
        });
      }
    },
  });
}

export async function createNewProject(name: string = 'Untitled Project'): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const project: Project = {
    id,
    name,
    lastModified: Date.now(),
    files: {},
    messages: [],
  };
  await db.put('projects', project);
  await setActiveProjectId(id);
  return id;
}

export async function saveProject(id: string, files: Record<string, FileEntry>, messages: Message[]) {
  const db = await getDb();
  const project = await db.get('projects', id);
  if (project) {
    project.files = files;
    project.messages = messages;
    project.lastModified = Date.now();
    await db.put('projects', project);
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  const db = await getDb();
  return (await db.get('projects', id)) ?? null;
}

export async function getAllProjects(): Promise<{ id: string; name: string; lastModified: number }[]> {
  const db = await getDb();
  const projects = await db.getAll('projects');
  return projects.map((p) => ({ id: p.id, name: p.name, lastModified: p.lastModified })).sort((a, b) => b.lastModified - a.lastModified);
}

export async function deleteProject(id: string) {
  const db = await getDb();
  await db.delete('projects', id);
  const activeId = await getActiveProjectId();
  if (activeId === id) {
    await db.delete('meta', 'activeProjectId');
  }
}

export async function getActiveProjectId(): Promise<string | null> {
  const db = await getDb();
  return (await db.get('meta', 'activeProjectId')) ?? null;
}

export async function setActiveProjectId(id: string) {
  const db = await getDb();
  await db.put('meta', id, 'activeProjectId');
}