/**
 * Icon component that renders Remix Icons
 */

import React from 'react';
import * as RemixIcons from '@remixicon/react';
import { ICON_MAP, type IconName } from '@/lib/iconMap';
import { cn } from '@/lib/utils';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

export function Icon({ name, className, size = 16 }: IconProps) {
  const iconComponentName = ICON_MAP[name];

  if (!iconComponentName) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  // Get the actual component from RemixIcons
  const IconComponent = (RemixIcons as any)[iconComponentName];

  if (!IconComponent) {
    console.warn(`Remix icon component "${iconComponentName}" not found`);
    return null;
  }

  return <IconComponent className={cn('inline-flex', className)} size={size} />;
}

// Export commonly used icons as individual components for convenience
export const ArchitectIcon = ({ className, size }: Omit<IconProps, 'name'>) => (
  <RemixIcons.RiBuilding2Line className={className} size={size} />
);

export const CoderIcon = ({ className, size }: Omit<IconProps, 'name'>) => (
  <RemixIcons.RiCodeSSlashLine className={className} size={size} />
);

export const DebuggerIcon = ({ className, size }: Omit<IconProps, 'name'>) => (
  <RemixIcons.RiToolsLine className={className} size={size} />
);

export const DesignerIcon = ({ className, size }: Omit<IconProps, 'name'>) => (
  <RemixIcons.RiPaletteLine className={className} size={size} />
);

export const TesterIcon = ({ className, size }: Omit<IconProps, 'name'>) => (
  <RemixIcons.RiCheckDoubleLine className={className} size={size} />
);