'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RiFileCopyLine, RiCodeSSlashLine, RiFolderLine, RiLoader4Line, RiErrorWarningLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import { AssayWordmark } from '@/components/Logo';

interface SharedProject {
  id: string;
  name: string;
  files: Record<string, { content: string; language: string }>;
  createdAt: string;
}

export default function SharedProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchProject() {
      try {
        const res = await fetch(`/api/share?id=${id}`, { signal: controller.signal });
        if (!res.ok) {
          setError(res.status === 404 ? 'Project not found' : 'Failed to load project');
          return;
        }
        const data = await res.json();
        if (controller.signal.aborted) return;
        setProject(data);
        const filePaths = Object.keys(data.files || {});
        if (filePaths.length > 0) {
          setActiveFile(filePaths[0]);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load project');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    if (id) fetchProject();
    return () => controller.abort();
  }, [id]);

  const handleCopyFile = async () => {
    if (!activeFile || !project) return;
    try {
      await navigator.clipboard.writeText(project.files[activeFile].content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available — silently ignore on shared page
    }
  };

  const handleForkToAssay = () => {
    if (!project) return;
    try {
      sessionStorage.setItem('assay-fork', JSON.stringify({
        name: project.name + ' (Fork)',
        files: project.files,
      }));
    } catch {
      // sessionStorage quota exceeded — continue anyway
    }
    window.location.href = '/app';
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <RiLoader4Line className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading shared project...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-center">
          <RiErrorWarningLine className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-4">{error || 'Project not found'}</p>
          <a href="/app" className="text-xs text-zinc-300 hover:text-zinc-50">
            Go to Assay
          </a>
        </div>
      </div>
    );
  }

  const filePaths = Object.keys(project.files);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="h-12 shrink-0 px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]">
        <div className="flex items-center gap-3">
          <a href="/app">
            <AssayWordmark className="text-[15px] text-zinc-100" />
          </a>
          <div className="w-px h-5 bg-white/[0.06]" />
          <div>
            <h1 className="text-sm font-medium text-zinc-200">{project.name}</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              Shared {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          onClick={handleForkToAssay}
          className="px-3.5 py-1.5 text-xs font-medium bg-zinc-50 text-zinc-950 hover:bg-white rounded-lg transition-all"
        >
          Fork to Assay
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* File list sidebar */}
        <div className="w-52 shrink-0 border-r border-white/[0.06] overflow-y-auto p-2">
          <div className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.16em] px-2 py-1.5 mb-1">
            Files ({filePaths.length})
          </div>
          {filePaths.map((path) => (
            <button
              key={path}
              onClick={() => setActiveFile(path)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left transition-colors',
                activeFile === path
                  ? 'bg-white/[0.06] text-zinc-50'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
              )}
            >
              <RiCodeSSlashLine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{path}</span>
            </button>
          ))}
        </div>

        {/* File content */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeFile && project.files[activeFile] && (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-[#0A0A0D]">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <RiFolderLine className="w-3.5 h-3.5" />
                  <span>{activeFile}</span>
                  <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {project.files[activeFile].language}
                  </span>
                </div>
                <button
                  onClick={handleCopyFile}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] rounded-lg transition-colors"
                >
                  <RiFileCopyLine className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <pre className="p-4 text-xs font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                  {project.files[activeFile].content}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
