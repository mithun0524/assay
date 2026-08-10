export type ModelOption = {
  id: string;
  label: string;
  contextLength: number;
  note?: string;
  supportsVision?: boolean;
};

/**
 * Sentinel: let the agent router pick the model for each message.
 */
export const AUTO_MODEL_ID = 'auto';

// The only models this app is allowed to call (all free on OpenRouter).
// Requires "Allow model training" to be ON in OpenRouter Settings > Privacy.
// Every id was checked against the live OpenRouter model list and advertises
// `tools` in supported_parameters — the agent calls tools now, so a model
// without them is useless here. `inclusionai/ling-3.0-flash:free` was removed:
// it 404s with "unavailable for free", and because it sat in the chain it
// burned a retry slot and poisoned the error the user finally saw.
//
// The first three are the picks; the rest exist only to give the fallback chain
// somewhere to go, and are spread across providers on purpose — a rate limit is
// usually applied per provider, so a chain of one vendor is a chain in name
// only.
export const MODEL_IDS = {
  nemotron: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  laguna: 'poolside/laguna-s-2.1:free',
  nemotronSuper: 'nvidia/nemotron-3-super-120b-a12b:free',
  northCode: 'cohere/north-mini-code:free',
  gemma: 'google/gemma-4-31b-it:free',
  lingTiny: 'inclusionai/ling-3.0-tiny:free',

  // Groq. A second provider means a second daily allowance — the point of the
  // fallback chain, which a single OpenRouter account could never deliver on
  // its own. All three support tool calling, which the agent now requires.
  // Skipped entirely when GROQ_API_KEY is unset, so they cost nothing to list.
  groqLlama: 'groq/llama-3.3-70b-versatile',
  groqOss: 'groq/openai/gpt-oss-120b',
  groqKimi: 'groq/moonshotai/kimi-k2-instruct',
} as const;

// Context lengths and capabilities verified against the OpenRouter model API.
// All three are text-only — none of them accept images.
export const FREE_MODELS: ModelOption[] = [
  {
    id: AUTO_MODEL_ID,
    label: 'Auto (Agent picks)',
    contextLength: 262144,
    note: 'Routes each message to the best agent + model',
  },
  {
    id: MODEL_IDS.nemotron,
    label: 'Nemotron 3 Ultra 550B',
    contextLength: 1_000_000,
    note: 'Largest model — planning, architecture, complex code',
  },
  {
    id: MODEL_IDS.laguna,
    label: 'Laguna S 2.1',
    contextLength: 262_144,
    note: 'Fast general coding',
  },
  {
    id: MODEL_IDS.nemotronSuper,
    label: 'Nemotron 3 Super 120B',
    contextLength: 262_144,
    note: 'Mid-size — general building',
  },
];

// Offered to the fallback chain but not to the picker: the list above is the
// choice, this is the safety net.
export const FALLBACK_ONLY_MODEL_IDS: string[] = [
  MODEL_IDS.northCode,
  MODEL_IDS.gemma,
  MODEL_IDS.lingTiny,
];

/** Model used when nothing else resolves. */
export const DEFAULT_MODEL_ID: string = MODEL_IDS.nemotron;

const ALLOWED_MODEL_IDS = new Set<string>(Object.values(MODEL_IDS));

/** True for a real, callable model id (excludes the `auto` sentinel). */
export function isValidModelId(id: unknown): id is string {
  return typeof id === 'string' && ALLOWED_MODEL_IDS.has(id);
}

/** Any allow-listed id, else the default — never lets a hallucinated id reach OpenRouter. */
export function resolveModelId(id: unknown): string {
  return isValidModelId(id) ? id : DEFAULT_MODEL_ID;
}

/** True when at least one allow-listed model can actually accept an image. */
export const VISION_SUPPORTED: boolean = FREE_MODELS.some((m) => m.supportsVision);

/**
 * Order to try when a model is unavailable. Measured on the free tier:
 * Nemotron regularly returns "ResourceExhausted: worker request limit reached",
 * so every model needs somewhere to fall back to.
 */
/**
 * The order models are tried in, best first.
 *
 * Providers are interleaved rather than listed in blocks. A rate limit is
 * applied per account, so a run of same-provider models fails together and the
 * chain stalls exactly when it is needed; alternating means the second attempt
 * is already somewhere else.
 *
 * `isUsable` lets the caller drop a provider with no key configured. Without it
 * an unconfigured provider burns a slot in every chain and returns an auth
 * error that reads like an outage.
 */
export function fallbackChain(
  preferred: string,
  isUsable: (modelId: string) => boolean = () => true,
): string[] {
  const primary = resolveModelId(preferred);
  const rest = Object.values(MODEL_IDS).filter((id) => id !== primary);

  const byProvider = new Map<string, string[]>();
  for (const id of rest) {
    const key = id.startsWith('groq/') ? 'groq' : 'openrouter';
    if (!byProvider.has(key)) byProvider.set(key, []);
    byProvider.get(key)!.push(id);
  }

  const interleaved: string[] = [];
  const queues = [...byProvider.values()];
  for (let i = 0; queues.some((q) => q.length); i++) {
    for (const q of queues) {
      const next = q.shift();
      if (next) interleaved.push(next);
    }
  }

  return [primary, ...interleaved].filter(isUsable);
}

export function getModelLabel(id: string): string {
  return FREE_MODELS.find((m) => m.id === id)?.label ?? id;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
