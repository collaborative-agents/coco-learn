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
