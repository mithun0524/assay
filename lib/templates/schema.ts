/**
 * Template schema for quick-start project templates
 */

export interface Template {
  /** Unique identifier for the template */
  id: string;
  /** Display name of the template */
  name: string;
  /** Brief description of what the template does */
  description: string;
  /** Category for filtering */
  category: 'landing' | 'dashboard' | 'ecommerce' | 'blog' | 'saas' | 'tool' | 'game';
  /** Base64 encoded thumbnail or emoji */
  thumbnail: string;
  /** Tags for search and filtering */
  tags: string[];
  /** File path to content mapping */
  files: Record<string, string>;
  /** npm dependencies to install */
  dependencies: Record<string, string>;
  /** Framework/build tool (vite, next, etc.) */
  framework: 'vite' | 'next';
  /** Install command (if different from npm install) */
  installCommand?: string;
  /** Dev server start command */
  startCommand: string;
}
