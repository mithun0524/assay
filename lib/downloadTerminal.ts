/**
 * Strip ANSI escape codes from terminal output so the downloaded file
 * is human-readable in any text editor.
 */
function stripAnsi(text: string): string {
  // Matches all common ANSI escape sequences: CSI, OSC, and simple escapes
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g,
    '',
  );
}

/**
 * Download terminal output as a text file
 */
export function downloadTerminalOutput(output: string, filename?: string) {
  // Generate filename with timestamp if not provided
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const finalFilename = filename || `terminal-output-${timestamp}.txt`;

  // Strip ANSI codes so the text file is readable
  const cleanOutput = stripAnsi(output);

  // Add header with timestamp and metadata
  const header = [
    '='.repeat(80),
    `Assay Terminal Output`,
    `Generated: ${new Date().toLocaleString()}`,
    '='.repeat(80),
    '',
  ].join('\n');

  // Combine header with terminal output
  const content = header + cleanOutput;

  // Create blob and download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;

  document.body.appendChild(link);
  link.click();

  // Cleanup after a short delay to ensure download starts
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Download terminal output as a log file with additional formatting
 */
export function downloadTerminalLog(output: string, filename?: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const finalFilename = filename || `terminal-${timestamp}.log`;

  const cleanOutput = stripAnsi(output);

  // Add LOG format header
  const header = [
    `[${new Date().toISOString()}] ===== Assay Terminal Log =====`,
    `[${new Date().toISOString()}] Session Start`,
    '',
  ].join('\n');

  const footer = [
    '',
    `[${new Date().toISOString()}] Session End`,
    `[${new Date().toISOString()}] ===== Log Complete =====`,
  ].join('\n');

  const content = header + cleanOutput + footer;

  // Create blob and download
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;

  document.body.appendChild(link);
  link.click();

  // Cleanup after a short delay to ensure download starts
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
