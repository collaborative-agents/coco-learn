import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import SessionChatView from '../renderer/components/SessionChatView';
import useParallelConversation from '../renderer/components/chat/useParallelConversation';

jest.mock('../renderer/useStudyAccess', () => ({
  __esModule: true,
  default: () => true,
}));
jest.mock('../renderer/components/TrainingView', () => ({
  __esModule: true,
  default: () => <div>Training</div>,
}));

function setup() {
  const listeners = new Map<string, Set<(data: any) => void>>();
  const emit = (channel: string, data: any) =>
    listeners.get(channel)?.forEach((listener) => listener(data));
  const saved = ['with', 'without'].map((sessionId) => ({
    sessionId,
    problem: '',
    messages: [{ role: 'tutor', text: `Welcome ${sessionId}` }],
  }));
  const invoke = jest.fn(
    async (channel: string, payload?: any): Promise<any> => {
      if (channel === 'get-chat-conversations') return saved;
      if (channel === 'tool-chapter-session')
        return {
          sessionId: payload,
          peerSessionId: payload === 'with' ? 'without' : 'with',
          mode: payload,
        };
      if (channel === 'tool-chapter-progress')
        return {
          externalInformation: false,
          approved: false,
          denied: false,
          completedAt: null,
        };
      if (channel === 'send-chat-message') return { streamed: true };
      return null;
    },
  );
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
  return { invoke, emit };
}

it.each(['with', 'without'])(
  'compares both conversations from %s and routes replies, approvals, and stop requests',
  async (mode) => {
    const { invoke, emit } = setup();
    render(<SessionChatView />);
    await act(async () =>
      emit('session-init', { sessionId: mode, problemStatement: '' }),
    );
    const withTools = await screen.findByRole('region', { name: 'With tools' });
    const withoutTools = screen.getByRole('region', { name: 'Without tools' });
    await within(withoutTools).findByText('Welcome without');
    expect(
      screen.queryByRole('button', { name: 'Try without tools' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(screen.getByPlaceholderText(/Ask Coco/), {
      target: { value: 'What is in notes.txt?' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/Ask Coco/), {
      key: 'Enter',
      code: 'Enter',
    });
    await waitFor(() =>
      expect(
        invoke.mock.calls.filter(
          ([channel]) => channel === 'send-chat-message',
        ),
      ).toHaveLength(2),
    );
    const requests = invoke.mock.calls
      .filter(([channel]) => channel === 'send-chat-message')
      .map(([, payload]) => payload);
    expect(requests.map((request) => request.sessionId).sort()).toEqual([
      'with',
      'without',
    ]);
    expect(
      requests.every((request) => request.userText === 'What is in notes.txt?'),
    ).toBe(true);
    const primary = requests.find((request) => request.sessionId === 'with');
    const peer = requests.find((request) => request.sessionId === 'without');
    await act(async () => {
      emit('chat-stream-event', {
        ...primary,
        type: 'text_delta',
        text: 'Reading the file',
      });
      emit('chat-stream-event', {
        ...peer,
        type: 'text_delta',
        text: 'I cannot read files',
      });
    });
    expect(within(withTools).getByText('Reading the file')).toBeInTheDocument();
    expect(
      within(withTools).queryByText('I cannot read files'),
    ).not.toBeInTheDocument();
    expect(
      within(withoutTools).getByText('I cannot read files'),
    ).toBeInTheDocument();
    await act(async () =>
      emit('chat-stream-event', {
        ...primary,
        type: 'agent_activity',
        text: 'Reading the file',
        activity: [
          {
            kind: 'permission',
            request: {
              id: 'permission-1',
              kind: 'action',
              directory: '/practice',
              tool: 'bash',
              arguments: { command: 'cat notes.txt' },
              status: 'pending',
            },
          },
        ],
      }),
    );
    fireEvent.click(within(withTools).getByRole('button', { name: 'Deny' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'answer-agent-permission',
        primary.requestId,
        'permission-1',
        false,
      ),
    );
    expect(
      within(withoutTools).queryByRole('region', {
        name: 'Permission request',
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(withoutTools).getByRole('button', { name: 'Stop' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('stop-agent-run', peer.requestId),
    );
    expect(invoke).not.toHaveBeenCalledWith(
      'stop-agent-run',
      primary.requestId,
    );
    await act(async () => {
      emit('chat-stream-event', {
        ...primary,
        type: 'done',
        guidance: 'File result',
      });
      emit('chat-stream-event', {
        ...peer,
        type: 'done',
        guidance: 'I cannot read files',
        stopped: true,
      });
    });
  },
);

it('keeps a failed peer request local and ignores stale history after changing conversations', async () => {
  const { invoke } = setup();
  const { result, rerender } = renderHook(
    ({ id }) => useParallelConversation(id),
    { initialProps: { id: 'without' } },
  );
  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  invoke.mockImplementation(async (channel) => {
    if (channel === 'send-chat-message') throw new Error('Offline');
    return [];
  });
  await act(async () => result.current.send('Read notes.txt'));
  expect(result.current.messages.at(-1)?.isError).toBe(true);
  expect(result.current.busy).toBe(false);
  let resolveHistory!: (value: unknown) => void;
  invoke.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveHistory = resolve;
      }),
  );
  rerender({ id: 'other' });
  rerender({ id: '' });
  await act(async () =>
    resolveHistory([
      { sessionId: 'other', messages: [{ role: 'tutor', text: 'Stale' }] },
    ]),
  );
  expect(result.current.messages).toEqual([]);
});

it('uses the normal chat transcript and composer for the Workflow quest', async () => {
  const { invoke, emit } = setup();
  const original = invoke.getMockImplementation()!;
  invoke.mockImplementation(async (channel: string, payload?: any) => {
    if (channel === 'tool-chapter-session') return null;
    if (channel === 'workflow-chapter-session')
      return {
        user: 'alice',
        sessionId: 'workflow',
        brief: '',
        draft: null,
        version: 0,
        trials: [],
        feedback: '',
        savedSkillId: null,
      };
    if (channel === 'get-chat-conversations')
      return [
        {
          sessionId: 'workflow',
          problem: 'Chapter 5 · Build your own skill',
          messages: [
            { role: 'tutor', text: 'What task would you like help with?' },
          ],
        },
      ];
    return original(channel, payload);
  });
  render(<SessionChatView />);
  await act(async () =>
    emit('session-init', {
      sessionId: 'workflow',
      problemStatement: 'Chapter 5 · Build your own skill',
    }),
  );
  expect(
    await screen.findByText('What task would you like help with?'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('complementary', { name: 'Chapter 5 training' }),
  ).toHaveTextContent('Build your own skill');
  const composer = screen.getByPlaceholderText(/Ask Coco/);
  fireEvent.change(composer, {
    target: { value: 'Help me create a weekly update skill.' },
  });
  fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'send-chat-message',
      expect.objectContaining({
        sessionId: 'workflow',
        userText: 'Help me create a weekly update skill.',
      }),
    ),
  );
  expect(
    invoke.mock.calls.some(([channel]) => channel === 'workflow-chapter-chat'),
  ).toBe(false);
  expect(
    screen.queryByRole('region', { name: 'Workflow quest chat' }),
  ).not.toBeInTheDocument();
  const request = invoke.mock.calls.find(
    ([channel]) => channel === 'send-chat-message',
  )![1];
  await act(async () =>
    emit('chat-stream-event', {
      sessionId: 'workflow',
      requestId: request.requestId,
      type: 'done',
      guidance: 'Who is the update for?',
    }),
  );
  expect(await screen.findByText('Who is the update for?')).toBeInTheDocument();
});

it('selects a curated skill from the normal input bar and sends it with the request', async () => {
  const { invoke, emit } = setup();
  const original = invoke.getMockImplementation()!;
  invoke.mockImplementation(async (channel, payload) => {
    if (channel === 'tool-chapter-session') return null;
    if (channel === 'curated-skills-list')
      return [
        {
          id: 'weekly',
          name: 'weekly-update',
          description: 'Prepare advisor notes.',
          markdown: '# Instructions',
          instructions: '# Instructions',
          files: [],
          savedAt: 'today',
        },
      ];
    return original(channel, payload);
  });
  render(<SessionChatView />);
  await act(async () =>
    emit('session-init', { sessionId: 'normal', problemStatement: '' }),
  );
  const composer = screen.getByRole('textbox', { name: 'Message Coco' });
  fireEvent.change(composer, { target: { value: 'Here are my notes.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  fireEvent.click(
    await screen.findByRole('button', {
      name: /weekly-update Prepare advisor notes/,
    }),
  );
  expect(composer).toHaveValue('/skill:weekly-update Here are my notes.');
  expect(
    screen.queryByRole('dialog', { name: 'Your skills' }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'send-chat-message',
      expect.objectContaining({
        sessionId: 'normal',
        userText: '/skill:weekly-update Here are my notes.',
      }),
    ),
  );
});
