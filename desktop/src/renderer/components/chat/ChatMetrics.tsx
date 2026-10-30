/* eslint react/require-default-props: ["error", { "functions": "defaultArguments" }] */
import { useContext } from 'react';
import TokenUsageAccess from './TokenUsageAccess';
import { tokenCounts } from '../../../shared/token-training';
import type { LLMCallMetrics } from '../observation-types';
import { S } from './styles';
import { formatMetricTokens, formatMetricLatency } from './message-format';

export default function ChatMetrics({
  observerMetrics = null,
  tutorMetrics = null,
}: {
  observerMetrics?: LLMCallMetrics | null;
  tutorMetrics?: LLMCallMetrics | null;
}) {
  const unlocked = useContext(TokenUsageAccess);
  const metrics = [observerMetrics, tutorMetrics].filter(
    (m): m is LLMCallMetrics => Boolean(m),
  );
  if (!unlocked) return null;

  const { input: inputTokens, output: outputTokens } = tokenCounts(
    observerMetrics,
    tutorMetrics,
  );
  const durationMs = metrics.reduce(
    (total, m) => total + (m.duration_ms ?? 0),
    0,
  );

  return (
    <div style={S.metricRow}>
      <span style={S.metricChip}>
        Input{' '}
        {inputTokens === null ? 'Unavailable' : formatMetricTokens(inputTokens)}{' '}
        / Output{' '}
        {outputTokens === null
          ? 'Unavailable'
          : formatMetricTokens(outputTokens)}
        {durationMs > 0 && <> / {formatMetricLatency(durationMs)}</>}
      </span>
    </div>
  );
}
