import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModelQuest from '../renderer/components/training/ModelQuest';
import type { ModelQuestSession } from '../shared/model-training';

jest.mock('../renderer/components/chat/MessageContent', () => ({
  TutorMessage: ({ text }: { text: string }) => <p>{text}</p>,
}));
const models = [
  { id: 'luna', model: 'openai/gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  { id: 'sol', model: 'openai/gpt-5.6-sol', label: 'GPT-5.6 Sol' },
];
test('sends one shared prompt, displays measured times, and finishes without a reflection', async () => {
  const invoke = jest.fn(async () => ({}));
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke } },
  });
  const session: ModelQuestSession = {
    user: 'alice',
    sessionId: 'quest',
    models,
    rounds: [],
    reflection: null,
  };
  const onNewChat = jest.fn();
  const view = render(
    <ModelQuest session={session} completedAt={null} onNewChat={onNewChat} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'model-chapter-run',
      'quest',
      expect.stringContaining('Rewrite'),
    ),
  );
  const responses = models.map((model, index) => ({
    model,
    requestId: model.id,
    runSessionId: model.id,
    text: `Answer ${model.id}`,
    status: 'done' as const,
    startedAt: Date.now(),
    firstResponseMs: 1000 + index * 1000,
    finishedMs: 3000 + index * 2000,
    metrics: null,
  }));
  session.rounds.push({
    id: 'one',
    kind: 'rewrite',
    prompt: 'Rewrite',
    responses,
  });
  view.rerender(
    <ModelQuest session={session} completedAt={null} onNewChat={onNewChat} />,
  );
  expect(
    screen.getByRole('button', { name: /2. Compare ideas/ }),
  ).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByLabelText('Try drawing with HTML')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /2. Compare ideas/ })).toHaveClass(
    'model-quest-next-step',
  );
  expect(screen.getByText('1.0s')).toBeInTheDocument();
  expect(screen.getByText('5.0s')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /2. Compare ideas/ }));
  expect(
    screen.getByRole('button', { name: /2. Compare ideas/ }),
  ).not.toHaveClass('model-quest-next-step');
  expect(
    screen.queryByRole('button', { name: 'Finish quest' }),
  ).not.toBeInTheDocument();
  session.rounds.push({
    id: 'two',
    kind: 'ideas',
    prompt: 'Draw a treehouse',
    responses: responses.map((response) => ({
      ...response,
      text: '```html\n<div>Treehouse</div>\n```',
    })),
  });
  view.rerender(
    <ModelQuest session={session} completedAt={null} onNewChat={onNewChat} />,
  );
  expect(screen.getByTitle('GPT-5.6 Luna drawing')).toHaveAttribute(
    'sandbox',
    '',
  );
  expect(screen.getByTitle('GPT-5.6 Sol drawing')).toHaveAttribute(
    'srcdoc',
    expect.stringContaining('<div>Treehouse</div>'),
  );
  expect(screen.queryByLabelText('Combine both')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Finish quest' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Send' }),
  ).not.toBeInTheDocument();
  expect(invoke).not.toHaveBeenCalledWith('model-chapter-complete', 'quest');
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose GPT-5.6 Sol output' }),
  );
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'model-chapter-complete',
      'quest',
      'sol',
    ),
  );
  expect(
    await screen.findByRole('dialog', { name: 'Chapter 4 passed! 🎉' }),
  ).toBeInTheDocument();
  const preview = screen.getByRole('combobox', {
    name: 'Model picker preview',
  });
  expect(preview).toHaveValue('sol');
  fireEvent.change(preview, { target: { value: 'luna' } });
  expect(preview).toHaveValue('luna');
  expect(invoke).not.toHaveBeenCalledWith('set-chat-model', expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Close task details' }));
  view.rerender(
    <ModelQuest session={session} completedAt="today" onNewChat={onNewChat} />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Try the model picker in a new chat' }),
  );
  expect(onNewChat).toHaveBeenCalled();
});
