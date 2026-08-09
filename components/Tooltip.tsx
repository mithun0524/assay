'use client';

import { isValidElement, cloneElement, type ReactElement } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  shortcut?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * A tooltip is a hover affordance, not an accessible name — it is portalled
 * out of the trigger and only exists while pointing at it. Almost every
 * icon-only button in this app is wrapped in one and had no name at all as a
 * result: a screen reader read "button", and so did the audit.
 *
 * Since `content` is already the human label for the control, it becomes the
 * `aria-label` too. Naming them one by one at the call sites would have missed
 * whichever ones were added next.
 */
function withAccessibleName(children: React.ReactNode, content: string): React.ReactNode {
  if (!isValidElement(children)) return children;
  const el = children as ReactElement<Record<string, unknown>>;
  const props = el.props;
  // Never override an explicit name, and don't label something that already
  // has visible text of its own.
  if (props['aria-label'] || props['aria-labelledby']) return children;
  return cloneElement(el, { 'aria-label': content });
}

export function Tooltip({ children, content, shortcut, side = 'bottom' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>
        {withAccessibleName(children, content)}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-50 flex items-center gap-2 px-2.5 py-1.5 bg-[#1a1a1e] border border-white/[0.1] shadow-xl rounded-lg text-xs text-zinc-300 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 text-[11px] font-mono text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded">
              {shortcut}
            </kbd>
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
