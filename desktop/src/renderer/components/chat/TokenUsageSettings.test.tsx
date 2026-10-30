import { summarizeTokenUsage } from './TokenUsageSettings';
import type { TokenUsageRecord } from '../../../shared/token-training';

test('filters local calendar periods and groups measured tokens by model without inventing missing counts', () => {
  const now = new Date(2026, 9, 29, 12);
  const record = (
    day: number,
    input: number | null,
    model = 'a',
  ): TokenUsageRecord => ({
    requestId: String(day),
    sessionId: 's',
    at: new Date(2026, 9, day, 10).toISOString(),
    model,
    input,
    output: 2,
    successful: true,
  });
  const requests = [
    record(29, 10),
    record(28, 20),
    record(23, null, 'b'),
    record(22, 100),
  ];
  expect(summarizeTokenUsage(requests, 'today', now)).toEqual([
    { model: 'a', input: 10, output: 2, unavailable: 0 },
  ]);
  expect(summarizeTokenUsage(requests, 'week', now)).toEqual([
    { model: 'a', input: 30, output: 4, unavailable: 0 },
    { model: 'b', input: 0, output: 2, unavailable: 1 },
  ]);
  expect(summarizeTokenUsage(requests, 'all', now)[0].input).toBe(130);
});
