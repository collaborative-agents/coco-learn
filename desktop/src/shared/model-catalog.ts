/** Public model IDs sent unchanged to the configured LLM router. */
export const OBSERVER_MODEL = {
  id: 'sensing',
  label: 'Claude Sonnet 4.6',
  provider: 'anthropic' as const,
  model: 'anthropic/claude-sonnet-4-6',
};

export const GEMINI_TUTOR_MODEL = {
  id: 'tutor-1',
  label: 'Gemini 4 Argon',
  provider: 'gemini' as const,
  model: 'gemini/gemini-4-argon',
};

export const TUTOR_MODEL_PRESETS = [
  GEMINI_TUTOR_MODEL,
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    provider: 'openai' as const,
    model: 'openai/gpt-5.6-sol',
  },
  {
    id: 'gpt-5.6-terra',
    label: 'GPT-5.6 Terra',
    provider: 'openai' as const,
    model: 'openai/gpt-5.6-terra',
  },
  {
    id: 'gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    provider: 'openai' as const,
    model: 'openai/gpt-5.6-luna',
  },
  {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    provider: 'anthropic' as const,
    model: 'anthropic/claude-sonnet-5-5',
  },
  {
    id: 'bedrock-claude-opus-5-5',
    label: 'Claude Opus 5.5',
    provider: 'anthropic' as const,
    model: 'anthropic/bedrock-claude-opus-5-5',
  },
];
