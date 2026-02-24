export interface ShadcnComponent {
  name: string;
  description: string;
  category: string;
  dependencies?: string[];
}

export const SHADCN_COMPONENTS: ShadcnComponent[] = [
  // Layout
  { name: 'accordion', description: 'Vertically stacked set of interactive headings that reveal content', category: 'layout' },
  { name: 'card', description: 'Container for grouping related content and actions', category: 'layout' },
  { name: 'collapsible', description: 'An interactive component that expands/collapses content', category: 'layout' },
  { name: 'separator', description: 'Visually separates content', category: 'layout' },
  { name: 'sheet', description: 'Extends Dialog with side panel slide-in behavior', category: 'layout' },
  { name: 'tabs', description: 'Set of layered sections of content shown one at a time', category: 'layout' },
  { name: 'resizable', description: 'Accessible resizable panel groups and layouts', category: 'layout' },
  { name: 'scroll-area', description: 'Augments native scroll with custom styling', category: 'layout' },

  // Forms
  { name: 'button', description: 'Interactive button with variants and sizes', category: 'forms' },
  { name: 'input', description: 'Text input field with consistent styling', category: 'forms' },
  { name: 'textarea', description: 'Multi-line text input', category: 'forms' },
  { name: 'checkbox', description: 'Toggle control for boolean values', category: 'forms' },
  { name: 'radio-group', description: 'Set of radio buttons for single selection', category: 'forms' },
  { name: 'select', description: 'Dropdown selection with search and filtering', category: 'forms' },
  { name: 'switch', description: 'Toggle control styled as a switch', category: 'forms' },
  { name: 'slider', description: 'Range input for numeric values', category: 'forms' },
  { name: 'form', description: 'Form wrapper with validation using react-hook-form', category: 'forms', dependencies: ['react-hook-form', '@hookform/resolvers', 'zod'] },
  { name: 'label', description: 'Accessible label for form controls', category: 'forms' },
  { name: 'input-otp', description: 'One-time password input with auto-focus', category: 'forms' },
  { name: 'calendar', description: 'Date picker calendar component', category: 'forms' },
  { name: 'date-picker', description: 'Date selection with popover calendar', category: 'forms' },

  // Data Display
  { name: 'table', description: 'Responsive table with consistent styling', category: 'data' },
  { name: 'badge', description: 'Small status indicator or label', category: 'data' },
  { name: 'avatar', description: 'Image or fallback for user representation', category: 'data' },
  { name: 'progress', description: 'Progress bar for loading or completion status', category: 'data' },
  { name: 'skeleton', description: 'Placeholder loading state for content', category: 'data' },
  { name: 'chart', description: 'Chart components built on Recharts', category: 'data', dependencies: ['recharts'] },
  { name: 'carousel', description: 'Slideshow component for cycling through elements', category: 'data' },

  // Feedback
  { name: 'alert', description: 'Callout for important messages', category: 'feedback' },
  { name: 'alert-dialog', description: 'Modal dialog for confirmations and alerts', category: 'feedback' },
  { name: 'dialog', description: 'Modal overlay for focused interactions', category: 'feedback' },
  { name: 'toast', description: 'Brief notification popup', category: 'feedback' },
  { name: 'sonner', description: 'Toast notifications using Sonner library', category: 'feedback' },
  { name: 'tooltip', description: 'Popup info on hover', category: 'feedback' },
  { name: 'popover', description: 'Floating content panel triggered by a button', category: 'feedback' },
  { name: 'hover-card', description: 'Preview content on hover', category: 'feedback' },

  // Navigation
  { name: 'breadcrumb', description: 'Navigation hierarchy indicator', category: 'navigation' },
  { name: 'command', description: 'Command palette / searchable menu', category: 'navigation' },
  { name: 'dropdown-menu', description: 'Menu triggered by a button click', category: 'navigation' },
  { name: 'menubar', description: 'Horizontal menu bar with dropdowns', category: 'navigation' },
  { name: 'navigation-menu', description: 'Navigation links with dropdown support', category: 'navigation' },
  { name: 'context-menu', description: 'Right-click context menu', category: 'navigation' },
  { name: 'pagination', description: 'Page navigation controls', category: 'navigation' },
  { name: 'sidebar', description: 'Sidebar navigation layout', category: 'navigation' },

  // Utility
  { name: 'aspect-ratio', description: 'Maintain consistent width-to-height ratio', category: 'utility' },
  { name: 'toggle', description: 'Two-state button (on/off)', category: 'utility' },
  { name: 'toggle-group', description: 'Group of toggle buttons', category: 'utility' },
  { name: 'drawer', description: 'Drawer component that slides from edges', category: 'utility' },
];

export const CATEGORIES = ['all', 'layout', 'forms', 'data', 'feedback', 'navigation', 'utility'] as const;

export type Category = typeof CATEGORIES[number];

export function searchComponents(query: string, category: Category): ShadcnComponent[] {
  let results = SHADCN_COMPONENTS;

  if (category !== 'all') {
    results = results.filter(c => c.category === category);
  }

  if (query) {
    const lower = query.toLowerCase();
    results = results.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      c.description.toLowerCase().includes(lower)
    );
  }

  return results;
}
