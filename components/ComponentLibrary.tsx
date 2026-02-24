'use client';

import { useState, useMemo } from 'react';
import { RiSearchLine, RiCloseLine, RiLoader4Line, RiCheckLine, RiLayoutLine } from '@remixicon/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SHADCN_COMPONENTS, CATEGORIES, searchComponents, type Category, type ShadcnComponent } from '@/lib/componentLibrary';
import { runShellInSandbox } from '@/lib/fileSystem';
import { useStore } from '@/lib/store';

interface ComponentLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComponentLibrary({ isOpen, onClose }: ComponentLibraryProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  const results = useMemo(() => searchComponents(search, category), [search, category]);

  const handleInstall = async (component: ShadcnComponent) => {
    if (installing) return;
    setInstalling(component.name);

    try {
      toast.loading(`Adding ${component.name}...`, { id: `shadcn-${component.name}` });

      const { previewUrl, sandboxStatus } = useStore.getState();
      const isRunning = previewUrl !== null && sandboxStatus === 'ready';

      if (isRunning) {
        const { stopDevServer } = await import('@/lib/fileSystem');
        await stopDevServer();
      }

      // Run the shadcn CLI to add the component
      const exitCode = await runShellInSandbox(
        `npx shadcn@latest add ${component.name} --yes --overwrite`,
        120000
      );

      if (exitCode === 0) {
        setInstalled(prev => new Set(prev).add(component.name));
        toast.success(`Added ${component.name}`, { id: `shadcn-${component.name}` });

        // Sync files from WebContainer back to store
        try {
          const { getWebContainer } = await import('@/lib/webcontainer');
          const wc = await getWebContainer();
          const componentPath = `components/ui/${component.name}.tsx`;
          try {
            const content = await wc.fs.readFile(componentPath, 'utf-8');
            useStore.getState().setFile(componentPath, { content, language: 'typescriptreact' });
          } catch {
            // Component might use a different file name, that's fine
          }
        } catch {
          // Sync is best-effort
        }
      } else {
        toast.error(`Failed to add ${component.name}. Check terminal for details.`, { id: `shadcn-${component.name}` });
      }

      // Restart dev server
      if (isRunning) {
        toast.loading('Restarting dev server...', { id: `shadcn-${component.name}` });
        useStore.getState().setPreviewUrl(null);
        try {
          const { startDevServerInSandbox } = await import('@/lib/fileSystem');
          await startDevServerInSandbox();
          toast.success('Dev server running', { id: `shadcn-${component.name}` });
        } catch {
          toast.error('Added component but failed to restart dev server', { id: `shadcn-${component.name}` });
        }
      }
    } catch (error) {
      console.error('Failed to install component:', error);
      toast.error(`Failed to add ${component.name}`, { id: `shadcn-${component.name}` });
    } finally {
      setInstalling(null);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: SHADCN_COMPONENTS.length };
    for (const c of SHADCN_COMPONENTS) {
      counts[c.category] = (counts[c.category] || 0) + 1;
    }
    return counts;
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg mx-4 rounded-2xl bg-[#111113] border border-white/[0.06] shadow-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <RiLayoutLine className="w-4 h-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-100">shadcn/ui Components</h2>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-all">
                <RiCloseLine className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 pb-2">
              <div className="relative">
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search components..."
                  className={cn(
                    'w-full pl-9 pr-3 py-2 rounded-xl text-xs text-zinc-200',
                    'bg-white/[0.04] border border-white/[0.06]',
                    'focus:outline-none focus:border-violet-500/40',
                    'placeholder:text-zinc-600 transition-all'
                  )}
                  autoFocus
                />
              </div>
            </div>

            {/* Category filters */}
            <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] rounded-lg transition-all capitalize',
                    category === cat
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
                  )}
                >
                  {cat} {categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}
                </button>
              ))}
            </div>

            {/* Component list */}
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-1.5">
              {results.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-600">
                  No components found
                </div>
              ) : (
                results.map((component) => {
                  const isInstalling = installing === component.name;
                  const isInstalled = installed.has(component.name);

                  return (
                    <div
                      key={component.name}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-200">{component.name}</span>
                          <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded capitalize">
                            {component.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{component.description}</p>
                      </div>
                      <button
                        onClick={() => handleInstall(component)}
                        disabled={isInstalling || isInstalled}
                        className={cn(
                          'shrink-0 ml-3 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all',
                          isInstalled
                            ? 'bg-emerald-500/15 text-emerald-400 cursor-default'
                            : isInstalling
                              ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                              : 'bg-violet-600/90 text-white hover:bg-violet-500 opacity-0 group-hover:opacity-100'
                        )}
                      >
                        {isInstalled ? (
                          <span className="flex items-center gap-1">
                            <RiCheckLine className="w-3 h-3" /> Added
                          </span>
                        ) : isInstalling ? (
                          <span className="flex items-center gap-1">
                            <RiLoader4Line className="w-3 h-3 animate-spin" /> Adding...
                          </span>
                        ) : (
                          'Add'
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-[11px] text-zinc-600">
                {SHADCN_COMPONENTS.length} components available
              </p>
              <a
                href="https://ui.shadcn.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                shadcn/ui docs
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
