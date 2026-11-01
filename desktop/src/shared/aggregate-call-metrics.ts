import type { LLMCallMetrics } from '../renderer/components/observation-types';
import { tokenCounts } from './token-training';

/** A missing count in any call must not become a misleading partial total. */
export default function aggregateCallMetrics(
  calls: LLMCallMetrics[],
): LLMCallMetrics | undefined {
  if (!calls.length) return undefined;
  const { input, output } = tokenCounts(...calls);
  return {
    ...(input !== null ? { input_tokens: input } : {}),
    ...(output !== null ? { output_tokens: output } : {}),
    ...(input !== null && output !== null
      ? { total_tokens: input + output }
      : {}),
    duration_ms: calls.reduce(
      (total, call) => total + (call.duration_ms ?? 0),
      0,
    ),
    success: calls.every((call) => call.success !== false),
  };
}
