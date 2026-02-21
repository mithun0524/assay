import type { FileEntry } from './store';

const MAX_CONTEXT_CHARS = 4000;
const PREVIEW_LINES = 5;

// Files to prioritize in the manifest (shown first, more preview lines)
const PRIORITY_FILES = [
    'package.json',
    'src/App.tsx',
    'src/main.tsx',
    'vite.config.ts',
    'tsconfig.json',
    'tailwind.config.js',
    'index.html',
];

/**
 * Builds a <current_files> XML block summarizing the project files
 * for injection into the system prompt, so the AI knows what exists.
 */
export function buildFileContext(files: Record<string, FileEntry>): string {
    const paths = Object.keys(files);
    if (paths.length === 0) return '';

    // Sort: priority files first, then alphabetical
    const sorted = [...paths].sort((a, b) => {
        const aIdx = PRIORITY_FILES.indexOf(a);
        const bIdx = PRIORITY_FILES.indexOf(b);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.localeCompare(b);
    });

    let result = '\n\n<current_files>\n';
    let charCount = result.length;

    for (const path of sorted) {
        const entry = files[path];
        const lines = entry.content.split('\n');
        const preview = lines.slice(0, PREVIEW_LINES).join('\n');
        const totalLines = lines.length;

        const block = `\n--- ${path} (${entry.language}, ${totalLines} lines) ---\n${preview}\n`;

        if (charCount + block.length > MAX_CONTEXT_CHARS) {
            // Just list remaining files without preview
            const remaining = sorted.slice(sorted.indexOf(path));
            const listBlock = `\n[${remaining.length} more files: ${remaining.join(', ')}]\n`;
            if (charCount + listBlock.length <= MAX_CONTEXT_CHARS + 200) {
                result += listBlock;
            }
            break;
        }

        result += block;
        charCount += block.length;
    }

    result += '</current_files>';
    return result;
}
