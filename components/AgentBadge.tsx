'use client';

import { cn } from '@/lib/utils';
import { getAgent, AgentRole } from '@/lib/agents';
import { Icon } from './Icon';
import type { IconName } from '@/lib/iconMap';

interface AgentBadgeProps {
  role: AgentRole;
  className?: string;
  showName?: boolean;
  /** Why this agent was picked — surfaced as a native tooltip. */
  title?: string;
}

export function AgentBadge({ role, className, showName = true, title }: AgentBadgeProps) {
  const agent = getAgent(role);

  return (
    <div
      title={title ?? agent.description}
      aria-label={`${agent.name} agent${title ? `: ${title}` : ''}`}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg',
        'bg-zinc-800/50 border border-white/[0.06]',
        'transition-all duration-200',
        className
      )}
    >
      <Icon name={agent.icon as IconName} className={agent.color} size={14} />
      {showName && (
        <span className={cn('text-xs font-medium', agent.color)}>{agent.name}</span>
      )}
    </div>
  );
}
