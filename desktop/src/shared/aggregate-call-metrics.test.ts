import aggregateCallMetrics from './aggregate-call-metrics';

test('combines the controller and skill trial calls across metric formats', () => {
  expect(
    aggregateCallMetrics([
      { input_tokens: 100, output_tokens: 20, duration_ms: 200 },
      { prompt_tokens: 300, completion_tokens: 40, duration_ms: 500 },
    ]),
  ).toEqual({
    input_tokens: 400,
    output_tokens: 60,
    total_tokens: 460,
    duration_ms: 700,
    success: true,
  });
});

test('keeps missing counts unknown and preserves actual zeros', () => {
  const result = aggregateCallMetrics([
    { input_tokens: 100, output_tokens: 0 },
    { output_tokens: 0 },
  ]);
  expect(result?.input_tokens).toBeUndefined();
  expect(result?.output_tokens).toBe(0);
  expect(result?.total_tokens).toBeUndefined();
  expect(aggregateCallMetrics([])).toBeUndefined();
  expect(aggregateCallMetrics([{}])?.input_tokens).toBeUndefined();
});
