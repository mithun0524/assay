/**
 * Where a model actually lives.
 *
 * Everything used to be OpenRouter, so the base URL and the key were constants
 * and the fallback chain was a list of model ids. That chain turned out to be
 * one chain in name only: a single OpenRouter account has one daily free-model
 * allowance, so when it runs out every model in the list fails at once and the
 * "fallback" has nowhere to go. A second provider is a second allowance, which
 * is the only thing that actually helps.
 *
 * A model id carries its provider as a prefix — `groq/llama-3.3-70b-versatile`
 * — and the prefix is stripped before the call. Ids without a known prefix are
 * OpenRouter's, which keeps every existing id working untouched.
 */

export type ProviderId = 'openrouter' | 'groq';

type Provider = {
  id: ProviderId;
  label: string;
  baseURL: string;
  /** Server-side env var holding the key. Never read in the browser. */
  envKey: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    // Groq is OpenAI SDK compatible, so it needs no client of its own — only a
    // different base URL and key.
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
  },
};

const PREFIX = 'groq/';

/** Which provider serves this id. Unprefixed ids are OpenRouter's. */
export function providerOf(modelId: string): ProviderId {
  return modelId.startsWith(PREFIX) ? 'groq' : 'openrouter';
}

/**
 * The id as the provider itself expects it.
 *
 * Only our own `groq/` prefix is stripped. OpenRouter ids legitimately contain
 * slashes (`nvidia/nemotron-...`) and must be passed through whole.
 */
export function bareModelId(modelId: string): string {
  return modelId.startsWith(PREFIX) ? modelId.slice(PREFIX.length) : modelId;
}

/**
 * Is this provider usable right now? Server-only — reads process.env.
 *
 * A provider with no key is skipped rather than attempted: without this, an
 * unconfigured Groq would burn a slot in every chain and return an auth error
 * that looks like an outage.
 */
export function providerConfigured(id: ProviderId): boolean {
  if (id === 'openrouter') {
    // OpenRouter can also be satisfied by a per-user key resolved from the
    // database, so the env var alone does not decide it.
    return true;
  }
  return Boolean(process.env[PROVIDERS[id].envKey]);
}
