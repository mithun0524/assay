// Strip ANSI escape codes from terminal output
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}

// Shared error patterns for terminal output detection
export const TERMINAL_ERROR_PATTERNS: RegExp[] = [
  /error\s*TS\d+:/i,
  /SyntaxError:/,
  /Cannot find module/,
  /Module not found/,
  /TypeError:/,
  /ReferenceError:/,
  /ENOENT/,
  /Failed to resolve/,
  /ERROR\s+in\s+/,
  /✘\s*\[ERROR\]/,
  /Build failed/i,
  /ELIFECYCLE/,
  /Cannot find name/,
  /Unexpected token/,
];

/**
 * Scan terminal text for error lines matching known patterns.
 * Returns an array of matched error lines (with surrounding context), or null if none found.
 */
export function detectTerminalErrors(text: string): string[] | null {
  const clean = stripAnsi(text);
  const lines = clean.split('\n');
  const errorLines: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const isError = TERMINAL_ERROR_PATTERNS.some((p) => p.test(line));
    if (isError) {
      capturing = true;
      errorLines.push(line.trim());
    } else if (capturing) {
      // Capture a few context lines after an error
      if (line.trim() && errorLines.length < 20) {
        errorLines.push(line.trim());
      } else {
        capturing = false;
      }
    }
  }

  return errorLines.length > 0 ? errorLines : null;
}
