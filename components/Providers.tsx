'use client';

import { Toaster } from 'sonner';
import { TooltipProvider } from './Tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <TooltipProvider delayDuration={400}>
            {children}
            <Toaster
                theme="dark"
                position="bottom-right"
                expand={false}
                richColors
                closeButton
            />
        </TooltipProvider>
    );
}
