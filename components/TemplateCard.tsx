'use client';

import { Template } from '@/lib/templates';
import { cn } from '@/lib/utils';
import {
  RiRocketLine,
  RiCalculatorLine,
  RiTaskLine,
  RiEditLine,
  RiShoppingCartLine,
  RiBriefcaseLine,
  RiSunCloudyLine,
  RiBarChartBoxLine,
  RiChat3Line,
  RiArticleLine,
} from '@remixicon/react';
import type { RemixiconComponentType } from '@remixicon/react';

const ICON_MAP: Record<string, { icon: RemixiconComponentType; color: string }> = {
  'saas-landing':       { icon: RiRocketLine,       color: 'text-violet-400 bg-violet-500/15' },
  'calculator':         { icon: RiCalculatorLine,    color: 'text-amber-400 bg-amber-500/15' },
  'task-manager':       { icon: RiTaskLine,          color: 'text-blue-400 bg-blue-500/15' },
  'markdown-editor':    { icon: RiEditLine,          color: 'text-emerald-400 bg-emerald-500/15' },
  'ecommerce-store':    { icon: RiShoppingCartLine,  color: 'text-orange-400 bg-orange-500/15' },
  'portfolio':          { icon: RiBriefcaseLine,     color: 'text-cyan-400 bg-cyan-500/15' },
  'weather-dashboard':  { icon: RiSunCloudyLine,     color: 'text-sky-400 bg-sky-500/15' },
  'admin-dashboard':    { icon: RiBarChartBoxLine,   color: 'text-pink-400 bg-pink-500/15' },
  'chat-app':           { icon: RiChat3Line,         color: 'text-indigo-400 bg-indigo-500/15' },
  'blog-platform':      { icon: RiArticleLine,       color: 'text-teal-400 bg-teal-500/15' },
};

interface TemplateCardProps {
  template: Template;
  onClick: (template: Template) => void;
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  const iconEntry = ICON_MAP[template.id];
  const Icon = iconEntry?.icon;

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
      <div className="mb-3 flex items-center justify-center">
        {Icon ? (
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconEntry.color)}>
            <Icon className="w-5 h-5" />
          </div>
        ) : (
          <div className="text-4xl">{template.thumbnail}</div>
        )}
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
