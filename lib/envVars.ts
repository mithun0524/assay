import { getWebContainer } from './webcontainer';
import { useStore } from './store';
import { getLanguageFromPath } from './utils';

export type EnvVar = {
  key: string;
  value: string;
};

/**
 * Parse .env file content into key-value pairs
 * Handles comments, empty lines, and basic formatting
 */
export function parseEnvFile(content: string): EnvVar[] {
  const lines = content.split('\n');
  const vars: EnvVar[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Find first equals sign
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = trimmed.substring(0, equalsIndex).trim();
    let value = trimmed.substring(equalsIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    vars.push({ key, value });
  }

  return vars;
}

/**
 * Serialize key-value pairs back to .env format
 */
export function serializeEnvFile(vars: EnvVar[]): string {
  return vars
    .filter(v => v.key.trim()) // Skip empty keys
    .map(v => {
      // Escape existing backslashes and quotes, then wrap if needed
      const escaped = v.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const needsQuotes = /[\s#"\\]/.test(v.value);
      const value = needsQuotes ? `"${escaped}"` : escaped;
      return `${v.key}=${value}`;
    })
    .join('\n');
}

/**
 * Read .env file from WebContainer
 */
export async function readEnvFile(): Promise<EnvVar[]> {
  try {
    const wc = await getWebContainer();
    const content = await wc.fs.readFile('.env', 'utf-8');
    return parseEnvFile(content);
  } catch {
    // File doesn't exist, return empty array
    return [];
  }
}

/**
 * Write .env file to WebContainer and sync to store
 */
export async function writeEnvFile(vars: EnvVar[]): Promise<void> {
  const wc = await getWebContainer();
  const content = serializeEnvFile(vars);
  await wc.fs.writeFile('.env', content);

  // Keep the store in sync so the file tree / editor reflect the change
  useStore.getState().setFile('.env', {
    content,
    language: getLanguageFromPath('.env'),
  });
}
