/* eslint-disable react/jsx-props-no-spreading -- Reuse the same banner props across quest steps. */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import TokenTrainingBanner from '../renderer/components/training/TokenTrainingBanner';
import TokenTrainingQuestion from '../renderer/components/training/TokenTrainingQuestion';
import type { TokenTrainingSession } from '../shared/token-training';

function Quest(props: React.ComponentProps<typeof TokenTrainingBanner>) {
  return (
    <>
      <TokenTrainingBanner {...props} />
      <div aria-label="Chat messages">
        <TokenTrainingQuestion {...props} />
      </div>
    </>
  );
}

test('guides two prompts, compares measured usage, allows quiz retries, and shows the reward', async () => {
  localStorage.clear();
  const session: TokenTrainingSession = {
    user: 'alice',
    sessionId: 'quest',
    requests: [],
  };
  const onPrompt = jest.fn();
  const onSettings = jest.fn();
  const invoke = jest.fn(async (channel, _id, answer) => {
    if (channel === 'token-chapter-progress') return { completedAt: 'today' };
    if (channel === 'token-usage')
      return { requests: session.requests, trackingSince: 'today' };
    return { correct: answer === 'context' };
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke } },
  });
  const props = {
    session,
    onPrompt,
    onSettings,
    busy: false,
    completedAt: null as string | null,
  };
  const view = render(<Quest {...props} />);
  expect(screen.getByRole('list', { name: 'Chapter goals' })).toHaveClass(
    'tool-training-goals',
  );
  expect(screen.getByLabelText('Send a request: Not yet')).not.toHaveClass(
    'is-complete',
  );
  fireEvent.click(screen.getByText('Use one-sentence prompt'));
  expect(onPrompt).toHaveBeenCalledWith(
    'Explain why the sky is blue in one sentence.',
  );
  session.requests = [
    {
      requestId: '1',
      sessionId: 'quest',
      model: 'a',
      at: '',
      input: 100,
      output: 20,
      successful: true,
    },
  ];
  view.rerender(<Quest {...props} />);
  expect(screen.getByLabelText('Send a request: Complete')).toHaveClass(
    'is-complete',
  );
  expect(screen.getByLabelText('Ask a follow-up: Not yet')).not.toHaveClass(
    'is-complete',
  );
  expect(screen.queryByText('Use follow-up prompt')).not.toBeInTheDocument();
  session.requests.push({
    ...session.requests[0],
    requestId: '2',
    input: 150,
    output: 80,
  });
  view.rerender(<Quest {...props} />);
  expect(screen.getByText('150')).toBeInTheDocument();
  const question = 'Why can a short follow-up use many input tokens?';
  expect(
    within(screen.getByLabelText('Chat messages')).getByText(question),
  ).toBeInTheDocument();
  expect(
    within(screen.getByLabelText('Chapter 3 training')).queryByText(question),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Ask a follow-up: Complete')).toHaveClass(
    'is-complete',
  );
  expect(
    screen.getByLabelText('Understand token usage: Not yet'),
  ).not.toHaveClass('is-complete');
  fireEvent.click(screen.getByText('Each word always counts as many tokens.'));
  expect(await screen.findByText(/Try again:/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByText(
      'The model also receives earlier conversation and other context.',
    ),
  );
  expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
  view.rerender(<Quest {...props} completedAt="today" />);
  expect(screen.getByText('Token tracking unlocked!')).toBeInTheDocument();
  expect(screen.getByLabelText('Understand token usage: Complete')).toHaveClass(
    'is-complete',
  );
  expect(
    screen.getByRole('dialog', { name: 'Chapter 3 passed! 🎉' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Token usage viewer unlocked')).toBeInTheDocument();
  const preview = within(screen.getByLabelText('Token usage preview'));
  expect(
    await preview.findByRole('region', { name: /Daily token usage calendar/ }),
  ).toBeInTheDocument();
  expect(preview.getByText('Token usage')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Open token usage'));
  expect(onSettings).toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  view.unmount();
  render(<Quest {...props} completedAt="today" />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
