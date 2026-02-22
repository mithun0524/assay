/**
 * Template applicator - applies a template to the current project
 */

import { Template } from './templates';
import { useStore, FileEntry } from './store';
import { writeFileToSandbox, installDependencies, startDevServerInSandbox } from './fileSystem';

/**
 * Apply a template to the current project
 * This will:
 * 1. Clear existing files
 * 2. Write all template files to WebContainer
 * 3. Install dependencies
 * 4. Start the dev server
 */
export async function applyTemplate(template: Template): Promise<void> {
  const store = useStore.getState();

  // Update state to show loading
  store.setSandboxStatus('booting');
  store.setGenerationPhase('writing');
  store.clearFiles();
  store.clearTerminal();
  store.setPreviewUrl(null);
  store.setCurrentTemplateId(template.id);
  store.setHasProject(true);

  try {
    // Convert template files to store format
    const files: Record<string, FileEntry> = {};
    for (const [path, content] of Object.entries(template.files)) {
      const language = getLanguageFromPath(path);
      files[path] = { content, language };
      store.setFile(path, { content, language });
    }

    // Write all files to WebContainer in parallel
    store.appendTerminal('📝 Creating project files...\r\n');
    await Promise.all(
      Object.entries(template.files).map(([path, content]) =>
        writeFileToSandbox(path, content)
      )
    );
    store.appendTerminal('✓ Files created\r\n\r\n');

    // Open main file in editor
    const mainFile = template.files['src/App.jsx'] ? 'src/App.jsx' : 'src/main.jsx';
    if (mainFile) {
      store.openTab(mainFile);
    }

    // Install dependencies (installDependencies prints its own status messages)
    store.setGenerationPhase('installing');
    await installDependencies();

    // Start dev server
    store.setGenerationPhase('starting');
    store.setSandboxStatus('starting');
    store.appendTerminal('🚀 Starting dev server...\r\n');

    const url = await startDevServerInSandbox();

    store.setPreviewUrl(url);
    store.setSandboxStatus('ready');
    store.setGenerationPhase('done');
    store.appendTerminal(`✓ Dev server started at ${url}\r\n`);

    // Take snapshot for undo/redo
    store.takeSnapshot();
  } catch (error) {
    console.error('Failed to apply template:', error);
    store.setSandboxStatus('error');
    store.setGenerationPhase('idle');
    store.appendTerminal(`\r\n❌ Error applying template: ${error instanceof Error ? error.message : 'Unknown error'}\r\n`);
    throw error;
  }
}

/**
 * Get language identifier from file path
 */
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    txt: 'plaintext',
  };
  return langMap[ext || ''] || 'plaintext';
}
