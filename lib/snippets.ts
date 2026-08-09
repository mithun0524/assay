export interface Snippet {
  id: string;
  name: string;
  language: string;
  code: string;
  createdAt: number;
}

const STORAGE_KEY = 'assay-snippets';

export function getSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSnippet(snippet: Omit<Snippet, 'id' | 'createdAt'>): Snippet {
  const snippets = getSnippets();
  const newSnippet: Snippet = {
    ...snippet,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  snippets.unshift(newSnippet);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  return newSnippet;
}

export function deleteSnippet(id: string): void {
  const snippets = getSnippets().filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
}

export function updateSnippet(id: string, updates: Partial<Pick<Snippet, 'name' | 'language' | 'code'>>): void {
  const snippets = getSnippets();
  const idx = snippets.findIndex(s => s.id === id);
  if (idx !== -1) {
    snippets[idx] = { ...snippets[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snippets));
  }
}

export const LANGUAGE_OPTIONS = [
  'typescript', 'javascript', 'html', 'css', 'json',
  'python', 'rust', 'go', 'bash', 'sql', 'markdown', 'other',
];

export const DEFAULT_SNIPPETS: Omit<Snippet, 'id' | 'createdAt'>[] = [
  {
    name: 'React useState',
    language: 'typescript',
    code: `const [value, setValue] = useState<string>('');`,
  },
  {
    name: 'React useEffect',
    language: 'typescript',
    code: `useEffect(() => {\n  // effect\n  return () => {\n    // cleanup\n  };\n}, []);`,
  },
  {
    name: 'Tailwind Flex Center',
    language: 'html',
    code: `<div className="flex items-center justify-center">`,
  },
  {
    name: 'Fetch API',
    language: 'typescript',
    code: `const response = await fetch('/api/endpoint');\nconst data = await response.json();`,
  },
];
