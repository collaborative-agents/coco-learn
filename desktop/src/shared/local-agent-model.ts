/** Editable starting point, matching the repository's InferenceHub tests. */
const localAgentModel = {
  id: 'nvidia-claude',
  label: 'Claude Sonnet · NVIDIA',
  provider: 'nv_inference',
  model: 'aws/anthropic/bedrock-claude-sonnet-4-6',
  baseUrl: 'https://inference-api.nvidia.com/v1/',
} as const;

export default localAgentModel;
