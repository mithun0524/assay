import type { FileEntry } from './store';

/**
 * Generate a CodeSandbox URL from project files.
 * Uses the CodeSandbox define API to create a sandbox from files.
 */
export function generateCodeSandboxUrl(files: Record<string, FileEntry>): string {
  const parameters = getCodeSandboxParameters(files);
  return `https://codesandbox.io/api/v1/sandboxes/define?parameters=${parameters}`;
}

function getCodeSandboxParameters(files: Record<string, FileEntry>): string {
  const csbFiles: Record<string, { content: string }> = {};

  for (const [path, entry] of Object.entries(files)) {
    csbFiles[path] = { content: entry.content };
  }

  // Ensure package.json exists
  if (!csbFiles['package.json']) {
    csbFiles['package.json'] = {
      content: JSON.stringify({ name: 'assay-export', dependencies: {} }, null, 2),
    };
  }

  const json = JSON.stringify({ files: csbFiles });
  return compressForUrl(json);
}

function compressForUrl(input: string): string {
  // CodeSandbox uses LZString-based encoding via their define API
  // We'll use base64 encoding as a simple fallback that the API supports
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a StackBlitz URL from project files.
 */
export function generateStackBlitzUrl(files: Record<string, FileEntry>): string {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = 'https://stackblitz.com/run';
  form.target = '_blank';

  // Add project metadata
  addHiddenInput(form, 'project[title]', 'Assay Export');
  addHiddenInput(form, 'project[template]', 'node');

  // Add files
  for (const [path, entry] of Object.entries(files)) {
    addHiddenInput(form, `project[files][${path}]`, entry.content);
  }

  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    document.body.removeChild(form);
  }

  return '';
}

function addHiddenInput(form: HTMLFormElement, name: string, value: string) {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  form.appendChild(input);
}

/**
 * Copy project files as a JSON string to clipboard for sharing.
 */
export async function copyProjectAsJson(files: Record<string, FileEntry>): Promise<void> {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    files: Object.fromEntries(
      Object.entries(files).map(([path, entry]) => [path, entry.content])
    ),
  };

  await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
}
