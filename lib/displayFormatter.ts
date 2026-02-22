/**
 * Format AI responses for display in chat
 * Shows what was generated without showing the full code
 */

import { BoltAction } from './streamParser';

/**
 * Format the AI response for display in the chat
 * Shows summaries of actions instead of raw code
 */
export function formatForDisplay(rawContent: string): string {
  const lines: string[] = [];

  // Extract any text before the first action
  const firstActionMatch = rawContent.match(/<boltAction/);
  if (firstActionMatch && firstActionMatch.index && firstActionMatch.index > 0) {
    const introText = rawContent.substring(0, firstActionMatch.index).trim();
    if (introText) {
      lines.push(introText);
      lines.push('');
    }
  }

  // Parse all actions and create summaries
  const fileActions: string[] = [];
  const shellActions: string[] = [];
  const searchActions: string[] = [];
  let startAction: string | null = null;

  // Match all boltAction tags
  const actionRegex = /<boltAction\s+type="([^"]+)"(?:\s+filePath="([^"]+)")?>[\s\S]*?<\/boltAction>/g;
  let match;

  while ((match = actionRegex.exec(rawContent)) !== null) {
    const [, type, filePath] = match;

    if (type === 'file' && filePath) {
      fileActions.push(filePath);
    } else if (type === 'shell') {
      // Extract command from content
      const commandMatch = match[0].match(/>([^<]+)</);
      if (commandMatch) {
        shellActions.push(commandMatch[1].trim());
      }
    } else if (type === 'start') {
      const commandMatch = match[0].match(/>([^<]+)</);
      if (commandMatch) {
        startAction = commandMatch[1].trim();
      }
    } else if (type === 'search') {
      const queryMatch = match[0].match(/>([^<]+)</);
      if (queryMatch) {
        searchActions.push(queryMatch[1].trim());
      }
    }
  }

  // Format the actions into readable summaries
  if (fileActions.length > 0) {
    lines.push('**Files Generated:**');
    fileActions.forEach(file => {
      const fileName = file.split('/').pop();
      const fileType = getFileType(file);
      lines.push(`   • \`${file}\``);
    });
    lines.push('');
  }

  if (shellActions.length > 0) {
    lines.push('**Commands Executed:**');
    shellActions.forEach(cmd => {
      lines.push(`   • \`${cmd}\``);
    });
    lines.push('');
  }

  if (searchActions.length > 0) {
    lines.push('**Web Searches:**');
    searchActions.forEach(query => {
      lines.push(`   • ${query}`);
    });
    lines.push('');
  }

  if (startAction) {
    lines.push('**Dev Server:**');
    lines.push(`   • \`${startAction}\``);
    lines.push('');
  }

  // Extract any text after the last action
  const lastActionMatch = rawContent.match(/<\/boltAction>/g);
  if (lastActionMatch) {
    const lastIndex = rawContent.lastIndexOf('</boltAction>');
    const endText = rawContent.substring(lastIndex + '</boltAction>'.length).trim();
    if (endText) {
      lines.push(endText);
    }
  }

  // If no actions were found, return the stripped content
  if (fileActions.length === 0 && shellActions.length === 0 && searchActions.length === 0 && !startAction) {
    // Just remove the boltAction tags but keep explanatory text
    return rawContent
      .replace(/<boltAction[\s\S]*?<\/boltAction>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return lines.join('\n');
}

function getFileType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    tsx: 'react',
    jsx: 'react',
    ts: 'typescript',
    js: 'javascript',
    css: 'style',
    html: 'markup',
    json: 'config',
    md: 'markdown',
  };
  return typeMap[ext || ''] || 'file';
}

function getFileIcon(type: string): string {
  const iconMap: Record<string, string> = {
    react: '⚛️',
    typescript: '📘',
    javascript: '📄',
    style: '🎨',
    markup: '📄',
    config: '⚙️',
    markdown: '📝',
    file: '📄',
  };
  return iconMap[type] || '📄';
}

/**
 * Extract just the planning text from the response
 */
export function extractPlanningText(rawContent: string): string {
  // Get text before first action
  const firstActionMatch = rawContent.match(/<boltAction/);
  if (firstActionMatch && firstActionMatch.index) {
    return rawContent.substring(0, firstActionMatch.index).trim();
  }
  return '';
}

/**
 * Count the number of files that will be created/modified
 */
export function countFileActions(rawContent: string): number {
  const matches = rawContent.match(/<boltAction\s+type="file"/g);
  return matches ? matches.length : 0;
}