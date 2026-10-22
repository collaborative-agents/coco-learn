import {
  buildRoleModelEnvironments,
  credentialId,
  isLlmRouterConfigured,
  normalizeRouterManagedModelConfiguration,
  ROUTER_MANAGED_MODEL_CONFIGURATION,
  validateModelConfiguration,
} from './model-config-store';

describe('model configuration', () => {
  const sensing = {
    id: 'sensing',
    label: 'Private sensing',
    provider: 'hosted_vllm' as const,
    model: 'hosted_vllm/Qwen/VL',
  };
  const tutors = [
    {
      id: 'fast',
      label: 'Fast tutor',
      provider: 'gemini' as const,
      model: 'gemini/gemini-flash',
    },
    {
      id: 'deep',
      label: 'Deep tutor',
      provider: 'anthropic' as const,
      model: 'anthropic/claude-sonnet',
    },
  ];

  it('requires independent sensing and tutor selections', () => {
    expect(
      validateModelConfiguration({
        sensing,
        tutors,
        defaultTutorId: 'fast',
      }),
    ).toEqual({ version: 1, sensing, tutors, defaultTutorId: 'fast' });
  });

  it('rejects a missing default tutor', () => {
    expect(() =>
      validateModelConfiguration({
        sensing,
        tutors,
        defaultTutorId: 'missing',
      }),
    ).toThrow('Choose a default tutor model.');
  });

  it('uses role-scoped credential IDs', () => {
    expect(credentialId('sensing', 'gemini')).toBe('sensing:gemini');
    expect(credentialId('tutor', 'gemini')).toBe('tutor:gemini');
  });

  it('recognizes a fully configured hosted router', () => {
    expect(
      isLlmRouterConfigured({
        LLM_ROUTER_URL: 'https://router.example.test',
        LLM_ROUTER_API_KEY: 'project-key',
      }),
    ).toBe(true);
    expect(
      isLlmRouterConfigured({ LLM_ROUTER_URL: 'https://router.example.test' }),
    ).toBe(false);
  });

  it('uses the pilot models when configuration is managed by the router', () => {
    expect(ROUTER_MANAGED_MODEL_CONFIGURATION.sensing.model).toBe(
      'anthropic/claude-sonnet-4-6',
    );
    expect(ROUTER_MANAGED_MODEL_CONFIGURATION.tutors[0].model).toBe(
      'gemini/gemini-4-argon',
    );
  });

  it('migrates saved Gemini 3 Flash selections to Argon', () => {
    const normalized = normalizeRouterManagedModelConfiguration(
      validateModelConfiguration({
        sensing,
        tutors: [
          {
            id: 'saved-flash',
            label: 'Gemini 3 Flash',
            provider: 'gemini',
            model: 'gemini/gemini-3-flash-preview',
          },
        ],
        defaultTutorId: 'saved-flash',
      }),
    );
    expect(normalized.defaultTutorId).toBe('saved-flash');
    expect(normalized.tutors[0]).toMatchObject({
      id: 'saved-flash',
      label: 'Gemini 4 Argon',
      model: 'gemini/gemini-4-argon',
    });
    expect(
      normalized.tutors.filter(
        (model) => model.model === 'gemini/gemini-4-argon',
      ),
    ).toHaveLength(1);
    expect(
      normalizeRouterManagedModelConfiguration(
        validateModelConfiguration(normalized),
      ),
    ).toEqual(normalized);
  });

  it('adds the requested tutor models while preserving existing selections', () => {
    const mixed = validateModelConfiguration({
      sensing,
      tutors,
      defaultTutorId: 'deep',
    });
    const normalized = normalizeRouterManagedModelConfiguration(mixed);
    expect(normalized.sensing.model).toBe('anthropic/claude-sonnet-4-6');
    expect(normalized.defaultTutorId).toBe('deep');
    expect(normalized.tutors).toEqual(expect.arrayContaining(tutors));
    expect(normalized.tutors.map((model) => model.model)).toEqual(
      expect.arrayContaining([
        'openai/gpt-5.6-sol',
        'openai/gpt-5.6-terra',
        'openai/gpt-5.6-luna',
        'anthropic/claude-sonnet-5-5',
        'anthropic/bedrock-claude-opus-5-5',
      ]),
    );
    expect(
      normalizeRouterManagedModelConfiguration(
        validateModelConfiguration(normalized),
      ),
    ).toEqual(normalized);
  });

  it('keeps a saved preset ID and handles colliding custom IDs', () => {
    const current = validateModelConfiguration({
      sensing,
      tutors: [
        {
          id: 'chosen',
          label: 'My Sol',
          provider: 'openai',
          model: 'openai/gpt-5.6-sol',
        },
        {
          id: 'gpt-5.6-terra',
          label: 'Other model',
          provider: 'openai',
          model: 'openai/custom',
        },
      ],
      defaultTutorId: 'chosen',
    });
    const normalized = normalizeRouterManagedModelConfiguration(current);
    expect(normalized.defaultTutorId).toBe('chosen');
    expect(
      normalized.tutors.filter((model) => model.model === 'openai/gpt-5.6-sol'),
    ).toHaveLength(1);
    expect(() => validateModelConfiguration(normalized)).not.toThrow();
  });

  it('does not expose sensing credentials to tutors or tutor credentials to sensing', () => {
    const config = validateModelConfiguration({
      sensing: { ...sensing, provider: 'gemini', model: 'gemini/vision' },
      tutors,
      defaultTutorId: 'fast',
    });
    const { sensingEnv, tutorEnv } = buildRoleModelEnvironments(config, {
      'sensing:gemini': 'sensing-secret',
      'tutor:gemini': 'tutor-google-secret',
      'tutor:anthropic': 'tutor-anthropic-secret',
    });

    expect(sensingEnv).toMatchObject({
      GEMINI_API_KEY: 'sensing-secret',
      MEMORY_MODEL: 'gemini/vision',
    });
    expect(sensingEnv).not.toHaveProperty('ANTHROPIC_API_KEY');
    expect(tutorEnv).toMatchObject({
      GEMINI_API_KEY: 'tutor-google-secret',
      ANTHROPIC_API_KEY: 'tutor-anthropic-secret',
    });
    expect(tutorEnv.GEMINI_API_KEY).not.toBe(sensingEnv.GEMINI_API_KEY);
  });

  it('supports an optional key for an OpenAI-compatible endpoint', () => {
    const config = validateModelConfiguration({
      sensing: {
        ...sensing,
        baseUrl: 'https://inference.example.test/v1',
      },
      tutors: [tutors[0]],
      defaultTutorId: 'fast',
    });
    const { sensingEnv } = buildRoleModelEnvironments(config, {
      'sensing:hosted_vllm': 'optional-endpoint-key',
    });

    expect(sensingEnv).toMatchObject({
      HOSTED_VLLM_API_BASE: 'https://inference.example.test/v1',
      HOSTED_VLLM_API_KEY: 'optional-endpoint-key',
    });
  });

  it('adds the internal routing prefix to raw endpoint model IDs', () => {
    const config = validateModelConfiguration({
      sensing: {
        ...sensing,
        model: 'thinkingmachines/inkling',
      },
      tutors: [tutors[0]],
      defaultTutorId: 'fast',
    });

    expect(config.sensing.model).toBe('hosted_vllm/thinkingmachines/inkling');
  });

  it('routes an Inkling tutor through Tinker with a tutor-scoped key', () => {
    const config = validateModelConfiguration({
      sensing,
      tutors: [
        {
          id: 'voice',
          label: 'Voice tutor',
          provider: 'tinker',
          model: 'thinkingmachines/Inkling-Small:peft:262144',
        },
      ],
      defaultTutorId: 'voice',
    });
    const { sensingEnv, tutorEnv } = buildRoleModelEnvironments(config, {
      'tutor:tinker': 'tinker-secret',
    });

    expect(config.tutors[0].model).toBe(
      'tinker/thinkingmachines/Inkling-Small:peft:262144',
    );
    expect(tutorEnv.TINKER_API_KEY).toBe('tinker-secret');
    expect(sensingEnv).not.toHaveProperty('TINKER_API_KEY');
  });
});
