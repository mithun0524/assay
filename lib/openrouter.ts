export type ModelOption = {
  id: string;
  label: string;
  contextLength: number;
  note?: string;
  supportsVision?: boolean;
};

// All confirmed free models on OpenRouter (no cost, :free suffix)
// Requires "Allow model training" to be ON in OpenRouter Settings > Privacy
export const FREE_MODELS: ModelOption[] = [
  {
    id: 'stepfun/step-3.5-flash:free',
    label: 'StepFun Flash (Recommended)',
    contextLength: 131072,
    note: 'Reliable default - fast and capable for all tasks',
  },
  {
    id: 'deepseek/deepseek-r1-0528:free',
    label: 'DeepSeek R1 (Powerful)',
    contextLength: 65536,
    note: 'Excellent reasoning, coding, and analysis',
  },
  {
    id: 'qwen/qwen3-coder:free',
    label: 'Qwen3 Coder (Code Specialist)',
    contextLength: 32768,
    note: 'Specialized for code generation',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    label: 'Llama 3.3 70B (Powerful)',
    contextLength: 131072,
    note: 'Large model, excellent for complex tasks',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    label: 'Gemma 3 27B (Creative)',
    contextLength: 8192,
    note: 'Good for UI/UX and creative tasks',
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    label: 'Nemotron Nano VL (Vision)',
    contextLength: 16384,
    note: 'Vision-language model for screenshots',
    supportsVision: true,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    label: 'GLM 4.5 Air',
    contextLength: 131072,
    note: 'Balanced performance',
  },
  {
    id: 'liquid/lfm-2.5-1.2b-thinking:free',
    label: 'LFM Thinking (Small)',
    contextLength: 32768,
    note: 'Small but thoughtful model',
  },
];

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';