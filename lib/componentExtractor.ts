/**
 * Component extractor for targeted component editing
 * Extracts component context from selected code range
 */

/**
 * Extract component context from selected code
 * This is a simplified version - in production you'd use AST parsing
 */
export function extractComponentContext(
  filePath: string,
  content: string,
  selectionRange: { startLine: number; endLine: number }
): {
  componentName: string | null;
  componentCode: string;
  imports: string[];
  fileContext: string;
} {
  const lines = content.split('\n');
  const selectedLines = lines.slice(selectionRange.startLine - 1, selectionRange.endLine);
  const selectedCode = selectedLines.join('\n');

  // Extract imports from the file
  const imports: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith('import ')) {
      imports.push(line.trim());
    }
  }

  // Try to find component name
  // Look for function/const component declarations
  let componentName: string | null = null;

  // Pattern 1: function ComponentName
  const functionMatch = selectedCode.match(/function\s+([A-Z][a-zA-Z0-9]*)/);
  if (functionMatch) {
    componentName = functionMatch[1];
  }

  // Pattern 2: const ComponentName =
  if (!componentName) {
    const constMatch = selectedCode.match(/const\s+([A-Z][a-zA-Z0-9]*)\s*=/);
    if (constMatch) {
      componentName = constMatch[1];
    }
  }

  // Pattern 3: export default function ComponentName
  if (!componentName) {
    const exportMatch = selectedCode.match(/export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/);
    if (exportMatch) {
      componentName = exportMatch[1];
    }
  }

  return {
    componentName,
    componentCode: selectedCode,
    imports,
    fileContext: content,
  };
}

/**
 * Build component edit prompt
 */
export function buildComponentEditPrompt(
  filePath: string,
  componentName: string | null,
  componentCode: string,
  imports: string[],
  userInstruction: string
): string {
  return `You are editing a specific component in an existing React project.

<component_context>
File: ${filePath}
${componentName ? `Component: ${componentName}` : 'Selected code'}

Current implementation:
\`\`\`tsx
${componentCode}
\`\`\`

File imports:
${imports.join('\n')}
</component_context>

User request: "${userInstruction}"

CRITICAL INSTRUCTIONS:
1. Output ONLY the specified file (${filePath}) - do NOT modify other files
2. Include the COMPLETE file content (not just the component) with your changes
3. Preserve all imports unless adding new ones
4. Keep the same component API (props) unless explicitly asked to change
5. Only modify the parts relevant to the user's request
6. Use existing dependencies - do NOT install new packages unless necessary
7. Output using <boltAction type="file"> format with full file content

Remember: Output the ENTIRE file with your changes, not just the modified component.`;
}
