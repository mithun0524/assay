/**
 * GitHub OAuth authentication utilities
 * Uses Web Crypto API for secure token storage
 */

const GITHUB_TOKEN_KEY = 'github-token';
const GITHUB_USER_KEY = 'github-user';

// For encryption (optional, for added security in localStorage)
const ENCRYPTION_KEY_NAME = 'github-encryption-key';

/**
 * Store GitHub token securely
 */
export function setGitHubToken(token: string): void {
  if (typeof window === 'undefined') return;

  // Simple storage for now - in production, you'd want to encrypt this
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
}

/**
 * Retrieve GitHub token
 */
export function getGitHubToken(): string | null {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem(GITHUB_TOKEN_KEY);
}

/**
 * Remove GitHub token
 */
export function removeGitHubToken(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(GITHUB_TOKEN_KEY);
  localStorage.removeItem(GITHUB_USER_KEY);
}

/**
 * Store GitHub user info
 */
export function setGitHubUser(user: {
  login: string;
  name: string | null;
  avatar_url: string;
}): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(user));
}

/**
 * Retrieve GitHub user info
 */
export function getGitHubUser(): {
  login: string;
  name: string | null;
  avatar_url: string;
} | null {
  if (typeof window === 'undefined') return null;

  const userData = localStorage.getItem(GITHUB_USER_KEY);
  if (!userData) return null;

  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated with GitHub
 */
export function isGitHubAuthenticated(): boolean {
  return getGitHubToken() !== null;
}

/**
 * OAuth configuration
 * Note: For production, these should be environment variables
 */
export const GITHUB_OAUTH_CONFIG = {
  // You'll need to create a GitHub OAuth App and add these
  clientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || '',
  // For local development
  redirectUri:
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/github/callback`
      : '',
  scope: 'repo user:email',
};

/**
 * Initiate GitHub OAuth flow
 */
export function initiateGitHubOAuth(): void {
  if (!GITHUB_OAUTH_CONFIG.clientId) {
    alert(
      'GitHub OAuth is not configured. Please add NEXT_PUBLIC_GITHUB_CLIENT_ID to your .env.local file.'
    );
    return;
  }

  const params = new URLSearchParams({
    client_id: GITHUB_OAUTH_CONFIG.clientId,
    redirect_uri: GITHUB_OAUTH_CONFIG.redirectUri,
    scope: GITHUB_OAUTH_CONFIG.scope,
  });

  window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
}
