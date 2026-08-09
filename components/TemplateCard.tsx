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

// The tint used to be a different hue per template. Colour is reserved for
// agent identity and status now, so every chip is neutral and the icon plus
// the template name carry the distinction.
const ICON_TINT = 'text-zinc-300 bg-white/[0.04] border border-white/[0.06]';

const ICON_MAP: Record<string, { icon: RemixiconComponentType; color: string }> = {
  'saas-landing':       { icon: RiRocketLine,       color: ICON_TINT },
  'calculator':         { icon: RiCalculatorLine,    color: ICON_TINT },
  'task-manager':       { icon: RiTaskLine,          color: ICON_TINT },
  'markdown-editor':    { icon: RiEditLine,          color: ICON_TINT },
  'ecommerce-store':    { icon: RiShoppingCartLine,  color: ICON_TINT },
  'portfolio':          { icon: RiBriefcaseLine,     color: ICON_TINT },
  'weather-dashboard':  { icon: RiSunCloudyLine,     color: ICON_TINT },
  'admin-dashboard':    { icon: RiBarChartBoxLine,   color: ICON_TINT },
  'chat-app':           { icon: RiChat3Line,         color: ICON_TINT },
  'blog-platform':      { icon: RiArticleLine,       color: ICON_TINT },
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
      <div className="absolute right-3 top-3 rounded-lg bg-white/[0.04] border border-white/[0.06] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-400">
        {template.category}
      </div>
    </button>
  );
}
