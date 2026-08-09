'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

function getSupabase() {
  return createClient();
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const isGitHubLinked = user?.app_metadata?.providers?.includes('github') ?? false;

  useEffect(() => {
    let initialResolved = false;

    // Subscribe first — this fires INITIAL_SESSION immediately with cached data
    // before any network request, making it faster than getSession()
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!initialResolved) {
          initialResolved = true;
          setLoading(false);
        }
        // INITIAL_SESSION fires synchronously with cached session
        // SIGNED_IN / TOKEN_REFRESHED fire after network validation
        if (event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    );

    // Fallback: if onAuthStateChange hasn't resolved after a short time,
    // resolve loading to avoid indefinite spinner
    const timeout = setTimeout(() => {
      if (!initialResolved) {
        initialResolved = true;
        setLoading(false);
      }
    }, 2000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGitHub = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'github',
      options: {
        scopes: 'repo user:email',
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    // Without this the button silently does nothing when the provider is
    // disabled in the Supabase dashboard.
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  /** Returns true when the user is signed in already (email confirmation off). */
  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) throw error;
    return Boolean(data.session);
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const linkGitHub = useCallback(async () => {
    const res = await fetch('/api/auth/link-github', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || 'Failed to link GitHub');
    }
  }, []);

  return {
    user,
    session,
    loading,
    isGitHubLinked,
    signInWithGitHub,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    linkGitHub,
  };
}
