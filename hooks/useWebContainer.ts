'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { getWebContainer } from '@/lib/webcontainer';

export function useWebContainer() {
  const { setSandboxStatus, sandboxStatus } = useStore();

  useEffect(() => {
    if (sandboxStatus !== 'idle') return;
    setSandboxStatus('booting');

    getWebContainer()
      .then(() => setSandboxStatus('idle'))
      .catch((err) => {
        console.error('WebContainer boot failed:', err);
        setSandboxStatus('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}