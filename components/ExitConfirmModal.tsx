'use client';

import { RiLogoutBoxRLine } from '@remixicon/react';
import { ConfirmModal } from './ConfirmModal';

/**
 * Sign-out confirmation. The dialog itself now lives in ConfirmModal — this is
 * only the copy, kept as its own component so the call sites don't change.
 */

interface ExitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ExitConfirmModal({ isOpen, onClose, onConfirm, loading }: ExitConfirmModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      icon={<RiLogoutBoxRLine className="w-5 h-5" />}
      title="Sign out?"
      description="You'll need to sign back in to access your projects and settings."
      confirmLabel="Sign out"
      loadingLabel="Signing out…"
    />
  );
}
