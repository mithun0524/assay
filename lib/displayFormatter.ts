/**
 * Format AI responses for display in chat
 * Shows compact action cards instead of raw code
 */

/**
 * Format the AI response for display in the chat.
 * Embeds ACTION_CARD markers that MessageBubble renders as collapsible cards.
 */
export function formatForDisplay(raw: string): string {
  // Some models wrap their output in tool-call markup that this app does not
  // use. It is not an action, so nothing downstream consumed it, and it landed
  // in the transcript as a stray "</tool_call>" in the middle of a sentence.
  // Stripped first so every branch below works on clean text — the tags carry
  // no meaning here, and removing them cannot affect boltAction extraction.
  // A block that wraps real actions keeps its contents — the action cards below
  // are built from them. A block that wraps only a tool-call payload is dropped
  // whole, because otherwise the tags disappear and the raw JSON argument blob
  // is left sitting in the transcript as if the agent had said it out loud.
  const unwrap = (_m: string, inner: string) => (inner.includes('<boltAction') ? inner : '');

  const rawContent = raw
    .replace(/<tool_call>([\s\S]*?)<\/tool_call>/g, unwrap)
    .replace(/<function_calls?>([\s\S]*?)<\/function_calls?>/g, unwrap)
    // Any half-streamed or unpaired remnants of the same markup.
    .replace(/<\/?(?:tool_call|function_calls?)>/g, '')
    .replace(/<\/?invoke[^>]*>/g, '');

  const parts: string[] = [];

  // Check if there are any actions (completed or in-progress)
  const hasAnyActions = /<boltAction/.test(rawContent);

  // Extract text before the first action
  const firstActionMatch = rawContent.match(/<boltAction/);
  if (firstActionMatch && firstActionMatch.index && firstActionMatch.index > 0) {
    const introText = rawContent.substring(0, firstActionMatch.index)
      .replace(/<\/?boltArtifact[^>]*>/g, '')
      .trim();
    if (introText) {
      parts.push(introText);
    }
  }

  // Parse completed actions
  const fileActions: string[] = [];
  const shellActions: string[] = [];
  const readActions: string[] = [];
  const listActions: string[] = [];
  const deleteActions: string[] = [];
  let startAction: string | null = null;

  const actionRegex = /<boltAction\s+type="([^"]+)"(?:\s+filePath="([^"]+)")?>[\s\S]*?<\/boltAction>/g;
  let match;

  while ((match = actionRegex.exec(rawContent)) !== null) {
    const [, type, filePath] = match;

    if (type === 'file' && filePath) {
      fileActions.push(filePath);
    } else if (type === 'shell') {
      const commandMatch = match[0].match(/>([^<]+)</);
      if (commandMatch) shellActions.push(commandMatch[1].trim());
    } else if (type === 'start') {
      const commandMatch = match[0].match(/>([^<]+)</);
      if (commandMatch) startAction = commandMatch[1].trim();
    } else if (type === 'read' && filePath) {
      readActions.push(filePath);
    } else if (type === 'list') {
      const patternMatch = match[0].match(/>([^<]*)</);
      listActions.push(patternMatch?.[1].trim() || '**');
    } else if (type === 'delete' && filePath) {
      deleteActions.push(filePath);
    }
  }

  // Also capture in-progress (unclosed) action tags for file paths
  const pendingFileMatch = rawContent.match(/<boltAction\s+type="file"\s+filePath="([^"]+)">[^<]*$/);
  if (pendingFileMatch && !fileActions.includes(pendingFileMatch[1])) {
    fileActions.push(pendingFileMatch[1]);
  }
  const pendingShellMatch = rawContent.match(/<boltAction\s+type="shell">[^<]*$/);
  if (pendingShellMatch) {
    const cmdText = pendingShellMatch[0].match(/>([^<]*)$/);
    if (cmdText && cmdText[1].trim()) shellActions.push(cmdText[1].trim());
  }
  const pendingStartMatch = rawContent.match(/<boltAction\s+type="start">[^<]*$/);
  if (pendingStartMatch) {
    const cmdText = pendingStartMatch[0].match(/>([^<]*)$/);
    if (cmdText && cmdText[1].trim()) startAction = cmdText[1].trim();
  }

  // Build the action card data if we have any actions
  if (hasAnyActions || fileActions.length > 0 || shellActions.length > 0 || startAction) {
    const cardData = JSON.stringify({
      files: fileActions,
      commands: shellActions,
      startCommand: startAction,
      reads: readActions,
      lists: listActions,
      deletes: deleteActions,
    });
    parts.push(`\n<!--ACTION_CARD:${cardData}-->\n`);
  }

  // Extract text after the last action (only if stream is likely done)
  const lastCloseIdx = rawContent.lastIndexOf('</boltAction>');
  if (lastCloseIdx !== -1) {
    const afterActions = rawContent.substring(lastCloseIdx + '</boltAction>'.length);
    // Only add trailing text if there's no pending action tag after the last close
    if (!/<boltAction/.test(afterActions)) {
      const endText = afterActions
        .replace(/<\/?boltArtifact[^>]*>/g, '')
        .trim();
      if (endText) {
        parts.push(endText);
      }
    }
  }

  // If no actions found at all, strip all bolt tags and return clean text
  if (!hasAnyActions && fileActions.length === 0 && shellActions.length === 0 && !startAction) {
    let cleaned = rawContent
      .replace(/<boltAction[\s\S]*?<\/boltAction>/g, '')
      .replace(/<\/?boltAction[^>]*>/g, '')
      .replace(/<\/?boltArtifact[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (cleaned && !cleaned.match(/[.!?]\s/) && (cleaned.includes('{') || cleaned.includes('import ') || cleaned.includes('function '))) {
      return '```\n' + cleaned + '\n```';
    }

    return cleaned;
  }

  return parts.join('\n');
}

/**
 * Extract just the planning text from the response
 */
export function extractPlanningText(rawContent: string): string {
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
