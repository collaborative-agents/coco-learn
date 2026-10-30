/* eslint-disable react/jsx-props-no-spreading -- Reuse the same banner props across quest steps. */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import TokenTrainingBanner from '../renderer/components/training/TokenTrainingBanner';
import type { TokenTrainingSession } from '../shared/token-training';

test('guides two prompts, compares measured usage, allows quiz retries, and shows the reward', async () => {
  const session: TokenTrainingSession = {
    user: 'alice',
    sessionId: 'quest',
    requests: [],
  };
  const onPrompt = jest.fn();
  const onSettings = jest.fn();
  const invoke = jest.fn(async (_channel, _id, answer) => ({
    correct: answer === 'context',
  }));
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
  const view = render(<TokenTrainingBanner {...props} />);
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
  view.rerender(<TokenTrainingBanner {...props} />);
  fireEvent.click(screen.getByText('Use follow-up prompt'));
  expect(onPrompt).toHaveBeenLastCalledWith('Now explain it in more detail.');
  session.requests.push({
    ...session.requests[0],
    requestId: '2',
    input: 150,
    output: 80,
  });
  view.rerender(<TokenTrainingBanner {...props} />);
  expect(screen.getByText('150')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Each word always counts as many tokens.'));
  expect(await screen.findByText(/Try again:/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByText(
      'The model also receives earlier conversation and other context.',
    ),
  );
  expect(await screen.findByText(/Correct!/)).toBeInTheDocument();
  view.rerender(<TokenTrainingBanner {...props} completedAt="today" />);
  expect(screen.getByText('Token tracking unlocked!')).toBeInTheDocument();
  fireEvent.click(screen.getByText('View token usage in Settings'));
  expect(onSettings).toHaveBeenCalled();
});
