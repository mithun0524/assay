'use client';

import { useState } from 'react';
import { RiCloseLine, RiDropLine, RiFontSize, RiBoxingLine, RiPaletteLine } from '@remixicon/react';
import { HexColorPicker } from 'react-colorful';
import { cn } from '@/lib/utils';
import { useChat } from '@/hooks/useChat';

interface InspectedElement {
  selector: string;
  tagName: string;
  classes: string[];
  styles: {
    backgroundColor?: string;
    color?: string;
    fontSize?: string;
    padding?: string;
    margin?: string;
    borderRadius?: string;
  };
}

interface StyleInspectorProps {
  element: InspectedElement | null;
  onClose: () => void;
}

export function StyleInspector({ element, onClose }: StyleInspectorProps) {
  const { submit } = useChat();
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTextPicker, setShowTextPicker] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!element) return null;

  const handleApplyStyles = async (styleChanges: Record<string, string>) => {
    setApplying(true);

    // Build a prompt for the AI to apply the style changes
    const prompt = `Update the styles for the ${element.tagName} element with classes "${element.classes.join(' ')}".

Apply these style changes:
${Object.entries(styleChanges)
  .map(([prop, value]) => `- ${prop}: ${value}`)
  .join('\n')}

Please update the relevant CSS or Tailwind classes in the appropriate file to match these styles.`;

    await submit(prompt, []);
    setApplying(false);
    onClose();
  };

  const handleQuickStyleChange = (property: string, value: string) => {
    handleApplyStyles({ [property]: value });
  };

  return (
    <div className="fixed right-4 top-20 bottom-4 w-80 z-40">
      <div className="h-full flex flex-col rounded-xl glass-strong border border-white/[0.06] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <RiPaletteLine className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Style Inspector</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <RiCloseLine className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Element info */}
          <div className="p-3 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
            <div className="text-xs font-medium text-zinc-400 mb-1">Element</div>
            <div className="text-sm text-zinc-200">
              &lt;{element.tagName.toLowerCase()}&gt;
            </div>
            {element.classes.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-zinc-400 mb-1">Classes</div>
                <div className="flex flex-wrap gap-1">
                  {element.classes.map((cls, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Background Color */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
              <RiDropLine size={14} />
              Background Color
            </label>
            <button
              onClick={() => setShowBgPicker(!showBgPicker)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-white/[0.06] hover:border-white/[0.15] transition-colors"
            >
              <div
                className="w-6 h-6 rounded border border-white/[0.15]"
                style={{ backgroundColor: element.styles.backgroundColor || '#000' }}
              />
              <span className="text-sm text-zinc-300">
                {element.styles.backgroundColor || 'None'}
              </span>
            </button>
            {showBgPicker && (
              <div className="mt-2">
                <HexColorPicker
                  color={element.styles.backgroundColor || '#000'}
                  onChange={(color) => handleQuickStyleChange('backgroundColor', color)}
                />
              </div>
            )}
          </div>

          {/* Text Color */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
              <RiFontSize size={14} />
              Text Color
            </label>
            <button
              onClick={() => setShowTextPicker(!showTextPicker)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-white/[0.06] hover:border-white/[0.15] transition-colors"
            >
              <div
                className="w-6 h-6 rounded border border-white/[0.15]"
                style={{ backgroundColor: element.styles.color || '#fff' }}
              />
              <span className="text-sm text-zinc-300">
                {element.styles.color || 'None'}
              </span>
            </button>
            {showTextPicker && (
              <div className="mt-2">
                <HexColorPicker
                  color={element.styles.color || '#fff'}
                  onChange={(color) => handleQuickStyleChange('color', color)}
                />
              </div>
            )}
          </div>

          {/* Font Size */}
          {element.styles.fontSize && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
                <RiFontSize size={14} />
                Font Size
              </label>
              <input
                type="range"
                min="10"
                max="72"
                value={parseInt(element.styles.fontSize) || 16}
                onChange={(e) =>
                  handleQuickStyleChange('fontSize', `${e.target.value}px`)
                }
                className="w-full"
              />
              <div className="text-xs text-zinc-500 mt-1">
                {element.styles.fontSize}
              </div>
            </div>
          )}

          {/* Border Radius */}
          {element.styles.borderRadius && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
                <RiBoxingLine size={14} />
                Border Radius
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={parseInt(element.styles.borderRadius) || 0}
                onChange={(e) =>
                  handleQuickStyleChange('borderRadius', `${e.target.value}px`)
                }
                className="w-full"
              />
              <div className="text-xs text-zinc-500 mt-1">
                {element.styles.borderRadius}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-400">
              Changes are applied using AI to update your code. The AI will modify the
              appropriate CSS or Tailwind classes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
