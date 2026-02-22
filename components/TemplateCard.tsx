'use client';

import { Template } from '@/lib/templates';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: Template;
  onClick: (template: Template) => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={() => onClick(template)}
      className={cn(
        'group relative overflow-hidden rounded-xl p-4',
        'glass glow-hover',
        'text-left transition-all duration-200',
        'hover:scale-[1.02]'
      )}
    >
      {/* Thumbnail */}
      <div className="mb-3 flex items-center justify-center text-4xl">
        {template.thumbnail}
      </div>

      {/* Content */}
      <h3 className="mb-1.5 text-sm font-semibold text-zinc-100">
        {template.name}
      </h3>
      <p className="mb-3 text-xs text-zinc-400 line-clamp-2">
        {template.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {template.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400"
          >
            {tag}
          </span>
        ))}
        {template.tags.length > 3 && (
          <span className="rounded-md bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400">
            +{template.tags.length - 3}
          </span>
        )}
      </div>

      {/* Category badge */}
      <div className="absolute right-3 top-3 rounded-lg bg-violet-500/10 px-2 py-1 text-xs font-medium text-violet-400">
        {template.category}
      </div>
    </button>
  );
}
