export type ModelOption = {
  id: string;
  label: string;
  contextLength: number;
  note?: string;
};

// All confirmed free models on OpenRouter (no cost, :free suffix)
// Requires "Allow model training" to be ON in OpenRouter Settings > Privacy
export const FREE_MODELS: ModelOption[] = [
  {
    id: 'stepfun/step-3.5-flash:free',
    label: 'DeepSeek V3 (Best for code)',
    contextLength: 131072,
    note: 'Recommended — strongest free coding model',
  },
  {
    id: 'meta-llama/llama-4-scout:free',
    label: 'Llama 4 Scout (Fast)',
    contextLength: 131072,
    note: 'Fast responses, great for iteration',
  },
  {
    id: 'meta-llama/llama-4-maverick:free',
    label: 'Llama 4 Maverick',
    contextLength: 131072,
    note: 'More capable than Scout',
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    label: 'Gemini 2.0 Flash (1M context)',
    contextLength: 1048576,
    note: 'Massive context — great for large projects',
  },
  {
    id: 'qwen/qwq-32b:free',
    label: 'QwQ 32B (Reasoning)',
    contextLength: 131072,
    note: 'Slower but thinks harder — good for complex apps',
  },
];

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';