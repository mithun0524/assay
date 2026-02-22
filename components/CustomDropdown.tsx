'use client';

import { useState, useRef, useEffect } from 'react';
import { RiArrowDownSLine, RiCheckLine } from '@remixicon/react';
import { cn } from '@/lib/utils';

interface DropdownOption {
    id: string;
    label: string;
    note?: string;
}

interface CustomDropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
    dropUp?: boolean;
}

export function CustomDropdown({ options, value, onChange, className, dropUp = false }: CustomDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find((o) => o.id === value);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div ref={dropdownRef} className={cn('relative', className)}>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'w-full flex items-center justify-between gap-2',
                    'bg-white/[0.04] border border-white/[0.08] rounded-lg',
                    'px-2.5 py-1.5 text-xs text-zinc-400',
                    'hover:bg-white/[0.06] hover:border-white/[0.12]',
                    'focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/30',
                    'transition-all duration-200 cursor-pointer',
                    isOpen && 'border-violet-500/30 bg-white/[0.06]'
                )}
            >
                <span className="truncate">{selectedOption?.label || 'Select...'}</span>
                <RiArrowDownSLine
                    className={cn(
                        'w-3 h-3 text-zinc-600 transition-transform duration-200 shrink-0',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {/* Dropdown panel */}
            <div
                className={cn(
                    'absolute z-50 w-full rounded-xl overflow-hidden',
                    'bg-[#18181b] border border-white/[0.1] shadow-xl shadow-black/50',
                    'backdrop-blur-xl',
                    'transition-all duration-200 ease-out',
                    dropUp
                        ? 'bottom-full mb-1.5 origin-bottom'
                        : 'top-full mt-1.5 origin-top',
                    isOpen
                        ? 'opacity-100 scale-100 translate-y-0'
                        : dropUp
                            ? 'opacity-0 scale-95 translate-y-1 pointer-events-none'
                            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                )}
            >
                <div className="py-1 max-h-64 overflow-y-auto">
                    {options.map((option) => {
                        const isSelected = option.id === value;
                        return (
                            <button
                                key={option.id}
                                onClick={() => {
                                    onChange(option.id);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    'w-full flex items-start gap-2 px-3 py-2 text-left text-xs transition-all duration-150',
                                    isSelected
                                        ? 'text-zinc-200 bg-violet-500/10'
                                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06]'
                                )}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="truncate font-medium">{option.label}</div>
                                    {option.note && (
                                        <div className="text-[10px] text-zinc-600 mt-0.5 truncate">{option.note}</div>
                                    )}
                                </div>
                                {isSelected && (
                                    <RiCheckLine className="w-3 h-3 mt-0.5 text-violet-400 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
