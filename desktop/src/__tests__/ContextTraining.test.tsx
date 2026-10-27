import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SessionChatView from '../renderer/components/SessionChatView';
import { emptyContextProgress } from '../shared/context-training';

jest.mock('../renderer/useStudyAccess', () => ({
  __esModule: true,
  default: () => true,
}));
jest.mock('../renderer/components/TrainingView', () => ({
  __esModule: true,
  default: () => <div>Training</div>,
}));

it('guides normal chat, keeps file references when adding prompts, and unlocks the viewer on completion', async () => {
  localStorage.clear();
  let progress = emptyContextProgress();
  const listeners = new Map<string, Set<(data: any) => void>>();
  const emit = (channel: string, data?: any) =>
    listeners.get(channel)?.forEach((listener) => listener(data));
  const invoke = jest.fn(async (channel: string, payload?: any) => {
    if (channel === 'context-chapter-session')
      return {
        user: 'alice',
        sessionId: payload,
        directory: null,
        linkedFiles: [],
      };
    if (channel === 'context-chapter-progress') return progress;
    if (channel === 'get-agent-context')
      return {
        estimatedTokens: 1200,
        reported: { contextWindow: 64000 },
        categories: [
          { id: 'system', label: 'System prompt', tokens: 800 },
          { id: 'messages', label: 'Conversation', tokens: 400 },
        ],
      };
    if (channel === 'get-chat-conversations')
      return [
        {
          sessionId: 'practice',
          messages: [{ role: 'tutor', text: 'Choose a working folder.' }],
          problem: 'Chapter 2 · Context',
        },
      ];
    if (channel === 'send-chat-message')
      return { guidance: 'This link supplies a path, not file contents.' };
    if (channel === 'select-chat-files')
      return { canceled: false, filePaths: ['/workspace/my notes.txt'] };
    return null;
  });
  (window as any).electron = {
    ipcRenderer: {
      invoke,
      sendMessage: jest.fn(),
      on: (channel: string, listener: (data: any) => void) => {
        if (!listeners.has(channel)) listeners.set(channel, new Set());
        listeners.get(channel)!.add(listener);
        return () => listeners.get(channel)!.delete(listener);
      },
    },
  };
  render(<SessionChatView />);
  await act(async () =>
    emit('session-init', {
      sessionId: 'practice',
      problemStatement: 'Chapter 2 · Context',
    }),
  );
  await screen.findByRole('complementary', { name: 'Chapter 2 training' });
  expect(
    screen.queryByRole('region', { name: 'With tools' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Context' }));
  expect(screen.getByRole('status')).toHaveTextContent('Complete Chapter 2');
  expect(invoke).not.toHaveBeenCalledWith(
    'get-agent-context',
    expect.anything(),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Ask about the workspace' }),
  );
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toContain(
    'Does choosing this folder mean',
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: '@"/workspace/my notes.txt"' },
  });
  expect(
    screen.queryByRole('listitem', { name: 'Link a file: Not yet' }),
  ).not.toBeInTheDocument();
  progress = { ...progress, workspaceSet: true };
  await act(async () => emit('context-chapter-progress-changed'));
  expect(
    screen.getByRole('listitem', { name: 'Set a workspace: Complete' }),
  ).toHaveClass('is-complete');
  expect(
    screen.getByRole('listitem', { name: 'Link a file: Not yet' }),
  ).toHaveAttribute('aria-current', 'step');
  expect(
    screen.queryByRole('button', { name: 'Ask about the workspace' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Ask about the file link' }),
  );
  expect(screen.getByRole('textbox')).toHaveValue(
    '@"/workspace/my notes.txt"\n\nWhat information did linking this file give you? Without opening it, tell me what you know about it.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'send-chat-message',
      expect.objectContaining({
        sessionId: 'practice',
        userText: expect.stringContaining('@"/workspace/my notes.txt"'),
      }),
    ),
  );
  expect(
    screen.queryByRole('dialog', { name: 'Chapter 2 passed! 🎉' }),
  ).not.toBeInTheDocument();
  progress = { ...progress, fileLinked: true };
  await act(async () => emit('context-chapter-progress-changed'));
  expect(
    screen.getByRole('listitem', { name: 'Link a file: Complete' }),
  ).toHaveClass('is-complete');
  expect(
    screen.getByRole('listitem', { name: 'Read the file: Not yet' }),
  ).toHaveAttribute('aria-current', 'step');
  expect(
    screen.getByRole('button', { name: 'Ask Coco to read it' }),
  ).toBeInTheDocument();
  progress = {
    workspaceSet: true,
    fileLinked: true,
    fileRead: true,
    completedAt: '2026-10-28T00:00:00Z',
  };
  await act(async () => emit('context-chapter-progress-changed'));
  await screen.findByRole('dialog', { name: 'Chapter 2 passed! 🎉' });
  await screen.findByText('≈ 1,200 tokens');
  expect(invoke).toHaveBeenCalledWith('get-agent-context', 'practice');
  expect(
    screen.getByLabelText('Estimated context composition').children,
  ).toHaveLength(2);
  expect(
    screen.queryByText(/Expand a section to see its contents/),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('listitem', { name: 'Read the file: Complete' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close task details' }));
  expect(
    screen.getByRole('complementary', { name: 'Chapter 2 training' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Complete Chapter 2 · Context to unlock this viewer.'),
  ).not.toBeInTheDocument();
});
