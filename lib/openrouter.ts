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
export const MODEL_IDS = {
  nemotron: 'nvidia/nemotron-3-ultra-550b-a55b:free',
  laguna: 'poolside/laguna-s-2.1:free',
  ling: 'inclusionai/ling-3.0-flash:free',
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
    note: 'Code specialist — edits, refactors, bug fixes',
  },
  {
    id: MODEL_IDS.ling,
    label: 'Ling 3.0 Flash',
    contextLength: 262_144,
    note: 'Fast — questions, tests, quick iterations',
  },
];

/** Model used when nothing else resolves. */
export const DEFAULT_MODEL_ID: string = MODEL_IDS.ling;

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
export function fallbackChain(preferred: string): string[] {
  const primary = resolveModelId(preferred);
  const rest = Object.values(MODEL_IDS).filter((id) => id !== primary);
  return [primary, ...rest];
}

export function getModelLabel(id: string): string {
  return FREE_MODELS.find((m) => m.id === id)?.label ?? id;
}

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
