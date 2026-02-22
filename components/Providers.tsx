'use client';

import { createContext, useContext } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from './Tooltip';
import { useAuth } from '@/hooks/useAuth';

type AuthContextType = ReturnType<typeof useAuth>;

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within Providers');
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
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
    </AuthContext.Provider>
  );
}
