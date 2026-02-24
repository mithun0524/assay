'use client';

import { useState, useMemo } from 'react';
import { ALL_TEMPLATES, getAllCategories, searchTemplates, type Template } from '@/lib/templates';
import { TemplateCard } from './TemplateCard';
import { RiSearchLine, RiCloseLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface TemplateGalleryProps {
  onSelectTemplate: (template: Template) => void;
  onClose: () => void;
}

export function TemplateGallery({ onSelectTemplate, onClose }: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Template['category'] | 'all'>('all');

  const categories = useMemo(() => getAllCategories(), []);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_TEMPLATES.forEach(t => { counts[t.category] = (counts[t.category] || 0) + 1; });
    return counts;
  }, []);

  const filteredTemplates = useMemo(() => {
    let templates = searchQuery ? searchTemplates(searchQuery) : ALL_TEMPLATES;

    if (selectedCategory !== 'all') {
      templates = templates.filter((t) => t.category === selectedCategory);
    }

    return templates;
  }, [searchQuery, selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl glass-strong">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-zinc-900/95 backdrop-blur-sm p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-zinc-100">Choose a Template</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            >
              <RiCloseLine size={20} />
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-full rounded-xl border border-white/[0.06] bg-zinc-800/50 py-2.5 pl-10 pr-4',
                'text-sm text-zinc-100 placeholder:text-zinc-500',
                'focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
              )}
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                selectedCategory === 'all'
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              All <span className="ml-1 opacity-60">{ALL_TEMPLATES.length}</span>
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all',
                  selectedCategory === category
                    ? 'bg-violet-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                )}
              >
                {category} <span className="ml-1 opacity-60">{categoryCounts[category] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Template grid */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 220px)' }}>
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={(t) => {
                    onSelectTemplate(t);
                    onClose();
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-zinc-400">No templates found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
