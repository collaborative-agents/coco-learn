import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ChatMetrics from './ChatMetrics';
import TokenUsageAccess from './TokenUsageAccess';

test('keeps request usage hidden before the reward is unlocked', () => {
  const { container } = render(
    <ChatMetrics tutorMetrics={{ input_tokens: 10, output_tokens: 2 }} />,
  );
  expect(container).toBeEmptyDOMElement();
});

test('shows restored usage across both metric formats when unlocked', () => {
  render(
    <TokenUsageAccess.Provider value>
      <ChatMetrics
        tutorMetrics={{
          prompt_tokens: 1200,
          completion_tokens: 300,
          duration_ms: 2000,
        }}
        observerMetrics={{
          input_tokens: 200,
          output_tokens: 50,
          duration_ms: 500,
        }}
      />
    </TokenUsageAccess.Provider>,
  );
  expect(
    screen.getByText('Input 1.4k / Output 350 / 2.5s'),
  ).toBeInTheDocument();
});

test('missing usage is unavailable, while an actual zero is preserved', () => {
  render(
    <TokenUsageAccess.Provider value>
      <ChatMetrics tutorMetrics={{ output_tokens: 0 }} />
    </TokenUsageAccess.Provider>,
  );
  expect(screen.getByText(/Input Unavailable \/ Output 0/)).toBeInTheDocument();
});
