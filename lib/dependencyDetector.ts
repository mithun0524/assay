import { getWebContainer } from './webcontainer';

/**
 * Extract package names from import statements
 * Handles various import formats including multiline:
 * - import foo from 'package'
 * - import { bar } from 'package'
 * - import * as baz from 'package'
 * - import {\n  bar,\n} from 'package'
 * - const foo = require('package')
 */
export function extractImports(code: string): string[] {
  const imports = new Set<string>();

  // ES6 import statements — single line
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // ES6 import statements — multiline (handles `import {\n  foo,\n} from 'pkg'`)
  const multilineImportRegex = /import\s+\{[\s\S]*?\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = multilineImportRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // CommonJS require statements
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  // Dynamic imports
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(code)) !== null) {
    imports.add(match[1]);
  }

  return Array.from(imports);
}

/**
 * Filter out built-in Node.js modules and relative/absolute paths
 * Returns only external package names
 */
export function filterExternalPackages(imports: string[]): string[] {
  const builtInModules = new Set([
    'fs', 'path', 'http', 'https', 'crypto', 'util', 'os', 'events',
    'stream', 'buffer', 'url', 'querystring', 'zlib', 'net', 'dns',
    'child_process', 'cluster', 'worker_threads', 'assert', 'tty',
    'readline', 'repl', 'vm', 'timers', 'console', 'module', 'process',
  ]);

  return imports.filter(pkg => {
    // Skip relative imports (./foo, ../bar)
    if (pkg.startsWith('.')) return false;

    // Skip absolute paths (/foo/bar)
    if (pkg.startsWith('/')) return false;

    // Skip built-in Node.js modules
    if (builtInModules.has(pkg)) return false;

    // Skip Node.js protocol imports (node:fs, node:path)
    if (pkg.startsWith('node:')) return false;

    // Skip path aliases (@/, ~/,  #/) but NOT scoped npm packages (@types/*, @babel/*, etc.)
    // Path aliases: @/ or ~/  or #/ (single char before slash)
    // Scoped packages: @scope/name (scope is a word, not just a symbol)
    if (/^[~#]\//.test(pkg)) return false;
    if (pkg.startsWith('@/')) return false;

    // Skip virtual/internal modules (vite, astro, etc.)
    if (pkg.startsWith('virtual:')) return false;

    return true;
  });
}

/**
 * Get base package name from import path
 * Examples:
 * - 'react' -> 'react'
 * - '@types/react' -> '@types/react'
 * - 'lodash/debounce' -> 'lodash'
 * - '@radix-ui/react-dialog' -> '@radix-ui/react-dialog'
 */
export function getBasePackageName(importPath: string): string {
  // Handle scoped packages (@scope/package)
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : importPath;
  }

  // Handle regular packages
  return importPath.split('/')[0];
}

/**
 * Read package.json and return installed dependencies.
 * Returns null if no package.json exists (no project set up yet).
 */
export async function getInstalledDependencies(): Promise<Set<string> | null> {
  try {
    const wc = await getWebContainer();
    const packageJsonContent = await wc.fs.readFile('package.json', 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    const deps = new Set<string>();

    if (packageJson.dependencies) {
      Object.keys(packageJson.dependencies).forEach(dep => deps.add(dep));
    }

    if (packageJson.devDependencies) {
      Object.keys(packageJson.devDependencies).forEach(dep => deps.add(dep));
    }

    return deps;
  } catch {
    // No package.json — return null to signal "no project"
    return null;
  }
}

/**
 * Validate that a package name looks like a real npm package.
 * Prevents injection of shell metacharacters.
 */
export function isValidPackageName(name: string): boolean {
  // npm package names: lowercase, may contain hyphens, dots, underscores, and scoped (@scope/name)
  return /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/.test(name);
}

/**
 * Detect missing dependencies in a file.
 * Returns array of package names that are imported but not in package.json.
 * Returns empty array if no package.json exists (avoids false positives).
 */
export async function detectMissingDependencies(code: string): Promise<string[]> {
  const installedDeps = await getInstalledDependencies();
  // No package.json — can't determine what's missing, skip detection
  if (installedDeps === null) return [];

  const imports = extractImports(code);
  const externalPackages = filterExternalPackages(imports);
  const basePackages = externalPackages.map(getBasePackageName);
  const uniquePackages = Array.from(new Set(basePackages));

  return uniquePackages
    .filter(pkg => !installedDeps.has(pkg))
    .filter(isValidPackageName); // Only suggest packages with safe names
}

/**
 * Check if a file might have dependencies to check
 * Skip binary files, images, etc.
 */
export function shouldCheckFile(filePath: string): boolean {
  const codeExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.vue', '.svelte', '.astro',
  ];

  return codeExtensions.some(ext => filePath.endsWith(ext));
}
