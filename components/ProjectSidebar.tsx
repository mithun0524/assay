'use client';

import { useEffect, useState } from 'react';
import { RiCloseLine, RiFolderLine, RiAddLine, RiDeleteBinLine, RiTimeLine, RiCheckLine } from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAllProjects, deleteProject, createNewProject } from '@/lib/db';
import { useStore } from '@/lib/store';
import { useChat } from '@/hooks/useChat';

interface Project {
    id: string;
    name: string;
    lastModified: number;
}

interface ProjectSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
}

export function ProjectSidebar({ isOpen, onClose, onSelectProject, onNewProject }: ProjectSidebarProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const { currentProjectId } = useStore();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const refreshProjects = async () => {
        try {
            const list = await getAllProjects();
            setProjects(list);
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            refreshProjects();
        }
    }, [isOpen]);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this project?')) {
            setIsDeleting(id);
            try {
                await deleteProject(id);
                toast.success('Project deleted');
                setIsDeleting(null);
                await refreshProjects();
                if (currentProjectId === id) {
                    onNewProject(); // If deleted current, start new
                }
            } catch (error) {
                console.error('Failed to delete project:', error);
                toast.error('Failed to delete project');
                setIsDeleting(null);
            }
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div
                className={cn(
                    "fixed top-0 left-0 bottom-0 w-80 glass-strong border-r border-white/[0.06] z-50 transform transition-transform duration-300 ease-in-out flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                    <span className="text-sm font-semibold text-zinc-100">Projects</span>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => {
                                onSelectProject(project.id);
                                onClose();
                            }}
                            className={cn(
                                "group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                                currentProjectId === project.id
                                    ? "bg-violet-500/10 border-violet-500/20"
                                    : "bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/[0.04]"
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={cn(
                                    "p-2 rounded-lg",
                                    currentProjectId === project.id ? "bg-violet-500/20 text-violet-300" : "bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200"
                                )}>
                                    <RiFolderLine className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className={cn(
                                        "text-sm font-medium truncate",
                                        currentProjectId === project.id ? "text-violet-200" : "text-zinc-300"
                                    )}>
                                        {project.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                        <RiTimeLine className="w-3 h-3" />
                                        <span>{new Date(project.lastModified).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {currentProjectId === project.id && (
                                <div className="text-violet-400">
                                    <RiCheckLine className="w-4 h-4" />
                                </div>
                            )}

                            <button
                                onClick={(e) => handleDelete(e, project.id)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                title="Delete project"
                            >
                                <RiDeleteBinLine className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    {projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
                            <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3">
                                <RiFolderLine className="w-5 h-5 text-zinc-600" />
                            </div>
                            <p className="text-sm font-medium text-zinc-500 mb-1">No projects yet</p>
                            <p className="text-xs text-zinc-600">Create a new project to get started</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-white/[0.06]">
                    <button
                        onClick={() => {
                            onNewProject();
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/[0.06] hover:bg-white/[0.09] text-zinc-200 text-sm font-medium rounded-xl border border-white/[0.06] transition-all"
                    >
                        <RiAddLine className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>
        </>
    );
}
