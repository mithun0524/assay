'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    RiCloseLine, RiFolderLine, RiAddLine, RiDeleteBinLine,
    RiTimeLine, RiCheckLine, RiStarLine, RiStarFill,
    RiSearchLine, RiPencilLine,
} from '@remixicon/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getAllProjects, deleteProject, toggleProjectFavorite, renameProject } from '@/lib/db';
import { useStore } from '@/lib/store';

interface Project {
    id: string;
    name: string;
    lastModified: number;
    isFavorite: boolean;
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
    const [searchQuery, setSearchQuery] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

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
            setSearchQuery('');
            setRenamingId(null);
        }
    }, [isOpen]);

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const q = searchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(q));
    }, [projects, searchQuery]);

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
                    onNewProject();
                }
            } catch (error) {
                console.error('Failed to delete project:', error);
                toast.error('Failed to delete project');
                setIsDeleting(null);
            }
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            const isFav = await toggleProjectFavorite(id);
            toast.success(isFav ? 'Added to favorites' : 'Removed from favorites');
            await refreshProjects();
        } catch {
            toast.error('Failed to update favorite');
        }
    };

    const handleStartRename = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation();
        setRenamingId(project.id);
        setRenameValue(project.name);
    };

    const handleRenameSubmit = async (id: string) => {
        if (renamingId !== id) return; // Guard against double-fire
        setRenamingId(null);
        const trimmed = renameValue.trim();
        if (!trimmed) return;
        try {
            await renameProject(id, trimmed);
            await refreshProjects();
        } catch {
            toast.error('Failed to rename project');
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
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">Projects</span>
                        <span className="text-[10px] text-zinc-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md">
                            {projects.length}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close projects panel"
                        title="Close projects panel"
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors"
                    >
                        <RiCloseLine className="w-4 h-4" />
                    </button>
                </div>

                {/* Search */}
                {projects.length > 3 && (
                    <div className="px-3 pt-3">
                        <div className="relative">
                            <RiSearchLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search projects..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs text-zinc-300 bg-white/[0.04] border border-white/[0.06] rounded-lg placeholder:text-zinc-600 focus:outline-none focus:border-white/45"
                            />
                        </div>
                    </div>
                )}

                {/* Project List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {filteredProjects.map((project) => (
                        <div
                            key={project.id}
                            onClick={() => {
                                if (renamingId === project.id) return;
                                onSelectProject(project.id);
                                onClose();
                            }}
                            className={cn(
                                "group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all border",
                                currentProjectId === project.id
                                    ? "bg-white/[0.06] border-white/[0.08]"
                                    : "bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/[0.04]"
                            )}
                        >
                            {/* Favorite star */}
                            <button
                                onClick={(e) => handleToggleFavorite(e, project.id)}
                                className={cn(
                                    "p-1 rounded-md transition-all shrink-0",
                                    project.isFavorite
                                        ? "text-amber-400 hover:text-amber-300"
                                        : "text-zinc-600 hover:text-amber-400 opacity-0 group-hover:opacity-100"
                                )}
                            >
                                {project.isFavorite
                                    ? <RiStarFill className="w-3.5 h-3.5" />
                                    : <RiStarLine className="w-3.5 h-3.5" />
                                }
                            </button>

                            {/* Folder icon */}
                            <div className={cn(
                                "p-1.5 rounded-lg shrink-0",
                                currentProjectId === project.id ? "bg-white/[0.09] text-zinc-100" : "bg-white/[0.06] text-zinc-400 group-hover:text-zinc-200"
                            )}>
                                <RiFolderLine className="w-3.5 h-3.5" />
                            </div>

                            {/* Name + date */}
                            <div className="flex flex-col min-w-0 flex-1">
                                {renamingId === project.id ? (
                                    <input
                                        autoFocus
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameSubmit(project.id);
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        onBlur={() => handleRenameSubmit(project.id)}
                                        className="text-sm font-medium text-zinc-200 bg-white/[0.06] border border-white/20 rounded px-1.5 py-0.5 outline-none"
                                    />
                                ) : (
                                    <span className={cn(
                                        "text-sm font-medium truncate",
                                        currentProjectId === project.id ? "text-zinc-50" : "text-zinc-300"
                                    )}>
                                        {project.name}
                                    </span>
                                )}
                                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                                    <RiTimeLine className="w-3 h-3" />
                                    <span>{new Date(project.lastModified).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Active indicator */}
                            {currentProjectId === project.id && (
                                <div className="text-zinc-300 shrink-0">
                                    <RiCheckLine className="w-3.5 h-3.5" />
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                                <button
                                    onClick={(e) => handleStartRename(e, project)}
                                    className="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] rounded-md transition-all"
                                    title="Rename"
                                >
                                    <RiPencilLine className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, project.id)}
                                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                    title="Delete project"
                                >
                                    <RiDeleteBinLine className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredProjects.length === 0 && projects.length > 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <p className="text-xs text-zinc-500">No projects match "{searchQuery}"</p>
                        </div>
                    )}

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

                {/* Footer */}
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
