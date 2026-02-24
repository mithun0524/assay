/**
 * Template library for quick-start projects
 *
 * Import this file to access all available templates
 */

import { Template } from './schema';
import { taskManagerTemplate } from './definitions/taskManager';
import { weatherDashboardTemplate } from './definitions/weatherDashboard';
import { markdownEditorTemplate } from './definitions/markdownEditor';
import { calculatorTemplate } from './definitions/calculator';
import { portfolioTemplate } from './definitions/portfolio';
import { saasLandingTemplate } from './definitions/saasLanding';
import { blogPlatformTemplate } from './definitions/blogPlatform';
import { ecommerceStoreTemplate } from './definitions/ecommerceStore';
import { chatAppTemplate } from './definitions/chatApp';
import { adminDashboardTemplate } from './definitions/adminDashboard';

/**
 * All available templates
 */
export const ALL_TEMPLATES: Template[] = [
  saasLandingTemplate,
  adminDashboardTemplate,
  ecommerceStoreTemplate,
  blogPlatformTemplate,
  chatAppTemplate,
  portfolioTemplate,
  taskManagerTemplate,
  weatherDashboardTemplate,
  markdownEditorTemplate,
  calculatorTemplate,
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: Template['category']): Template[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

/**
 * Search templates by query (name, description, tags)
 */
export function searchTemplates(query: string): Template[] {
  const lowerQuery = query.toLowerCase();
  return ALL_TEMPLATES.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get all unique categories
 */
export function getAllCategories(): Template['category'][] {
  return Array.from(new Set(ALL_TEMPLATES.map((t) => t.category)));
}

export type { Template } from './schema';
