'use client';

import { useEffect, useState } from 'react';
import { RiGithubLine, RiLogoutBoxRLine } from '@remixicon/react';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import {
  initiateGitHubOAuth,
  getGitHubToken,
  getGitHubUser,
  setGitHubToken,
  setGitHubUser,
} from '@/lib/githubAuth';
import { getGitHubUser as fetchGitHubUser } from '@/lib/github';

export function GitHubAuthButton() {
  const { githubUser, setGitHubUser: setStoreGitHubUser, disconnectGitHub } = useStore();
  const [loading, setLoading] = useState(false);

  // Load GitHub user from localStorage on mount
  useEffect(() => {
    const token = getGitHubToken();
    const user = getGitHubUser();

    if (token && user) {
      setStoreGitHubUser(user);
    }
  }, [setStoreGitHubUser]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      // For now, we'll use a personal access token approach
      // In production, you'd use the OAuth flow
      const token = prompt(
        'Enter your GitHub Personal Access Token:\n\n' +
          '1. Go to https://github.com/settings/tokens\n' +
          '2. Click "Generate new token (classic)"\n' +
          '3. Select "repo" scope\n' +
          '4. Generate and copy the token'
      );

      if (!token) {
        setLoading(false);
        return;
      }

      // Validate token by fetching user info
      const user = await fetchGitHubUser(token);

      // Store token and user info
      setGitHubToken(token);
      setGitHubUser({
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      });

      // Update store
      setStoreGitHubUser({
        login: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      });
    } catch (error) {
      console.error('GitHub auth error:', error);
      alert(
        'Failed to authenticate with GitHub. Please check your token and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect from GitHub? You can reconnect anytime.')) {
      disconnectGitHub();
    }
  };

  if (githubUser) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50">
          <img
            src={githubUser.avatar_url}
            alt={githubUser.login}
            className="w-5 h-5 rounded-full"
          />
          <span className="text-xs text-zinc-300">{githubUser.login}</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Disconnect GitHub"
        >
          <RiLogoutBoxRLine size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        loading
          ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
      )}
    >
      <RiGithubLine size={16} />
      {loading ? 'Connecting...' : 'Connect GitHub'}
    </button>
  );
}
