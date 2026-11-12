import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import SessionChatView from '../renderer/components/SessionChatView';
import WindowControls from '../renderer/components/chat/WindowControls';

jest.setTimeout(20000);

let mockStudyAccess = true;
jest.mock('../renderer/useStudyAccess', () => ({
  __esModule: true,
  default: () => mockStudyAccess,
}));
jest.mock('../renderer/components/TrainingView', () => ({
  __esModule: true,
  default: ({
    visible,
    refreshKey,
  }: {
    visible: boolean;
    refreshKey: number;
  }) => (
    <div data-active={visible} data-refresh={refreshKey}>
      Training task content
    </div>
  ),
}));

const listeners = new Map<string, (payload?: unknown) => void>();
let invoke: jest.Mock;
let sendMessage: jest.Mock;
beforeEach(() => {
  mockStudyAccess = true;
  listeners.clear();
  sendMessage = jest.fn();
  invoke = jest.fn(async (channel) =>
    channel === 'get-chat-conversations' ? [] : null,
  );
  const subscriptions = new Map<string, Set<(payload?: unknown) => void>>();
  (window as any).electron = {
    ipcRenderer: {
      invoke,
      sendMessage,
      on: jest.fn((channel, callback) => {
        const callbacks = subscriptions.get(channel) ?? new Set();
        callbacks.add(callback);
        subscriptions.set(channel, callbacks);
        listeners.set(channel, payload => callbacks.forEach(listener => listener(payload)));
        return () => { callbacks.delete(callback); if (!callbacks.size) listeners.delete(channel); };
      }),
    },
  };
});

it('reflects native pin state and requests pin/unpin beside the expand control', async () => {
  render(<WindowControls expanded onExpandedChange={jest.fn()} />);
  await act(async () => {});
  expect(sendMessage).toHaveBeenCalledWith('get-chat-window-pin-state');
  const pin = screen.getByRole('button', { name: 'Pin window on top' });
  expect(pin).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(pin);
  expect(sendMessage).toHaveBeenCalledWith('set-chat-window-pinned', {
    pinned: true,
  });
  act(() => listeners.get('chat-window-pin-state')?.({ pinned: true }));
  const unpin = screen.getByRole('button', { name: 'Unpin window' });
  expect(unpin).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(unpin);
  expect(sendMessage).toHaveBeenCalledWith('set-chat-window-pinned', {
    pinned: false,
  });
});

it('activates Training only when opened and refreshes repeated menu requests', async () => {
  render(<SessionChatView />);
  const training = screen.getByText('Training task content');
  expect(training).toHaveAttribute('data-active', 'false');
  expect(training).toHaveAttribute('data-refresh', '0');
  await act(async () => {
    listeners.get('open-training-panel')?.();
  });
  expect(training).toHaveAttribute('data-active', 'true');
  expect(training).toHaveAttribute('data-refresh', '1');
  await act(async () => {
    listeners.get('open-training-panel')?.();
  });
  expect(training).toHaveAttribute('data-refresh', '2');
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(training).toHaveAttribute('data-active', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  expect(training).toHaveAttribute('data-active', 'true');
  expect(training).toHaveAttribute('data-refresh', '3');
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(training).toHaveAttribute('data-active', 'false');
  await act(async () => {});
});

it('lights the Chat rail button during the pet invitation and opens the same Chat', async () => {
  render(<SessionChatView />);
  await act(async () => listeners.get('open-training-panel')?.());
  await act(async () => listeners.get('getting-started-chat-invite')?.({ articleId: 'ai-copilot' }));
  const chat = screen.getByRole('button', { name: 'Chat' });
  expect(chat).toHaveAttribute('data-guided-target', 'true');
  expect(chat).not.toHaveAttribute('aria-current');
  fireEvent.click(chat);
  expect(sendMessage).toHaveBeenCalledWith('getting-started-open-chat', { articleId: 'ai-copilot', phase: 'chat' });
  await act(async () => listeners.get('getting-started-chat-invite')?.({ articleId: null }));
  expect(chat).not.toHaveAttribute('data-guided-target');
});

it('creates a normal conversation before sending when Chat has no session', async () => {
  invoke.mockImplementation(async (channel) => {
    if (channel === 'get-chat-conversations') return [];
    if (channel === 'ensure-chat-conversation') return { sessionId: 'ready-chat' };
    if (channel === 'send-chat-message') return { guidance: 'Ready.' };
    return null;
  });
  render(<SessionChatView />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Message Coco' }), { target: { value: 'Hello Coco' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-chat-message', expect.objectContaining({ sessionId: 'ready-chat', userText: 'Hello Coco' })));
  expect(screen.queryByText('Open a conversation first.')).toBeNull();
});

it('keeps training accessible while tutoring remains locked', async () => {
  mockStudyAccess = false;
  render(<SessionChatView />);
  expect(screen.getByText('Training task content')).not.toBeVisible();
  expect(screen.queryByPlaceholderText(/Ask Coco/)).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Start a new session' }),
  ).toBeDisabled();
  expect(
    screen.getByText(/AI tutoring is currently unavailable/),
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  expect(screen.getByText('Training task content')).toBeVisible();
  expect(
    screen.getByText(/AI tutoring is currently unavailable/),
  ).not.toBeVisible();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get-profile'));
});

it('keeps Chat independent of the Getting Started task', async () => {
  invoke.mockImplementation(async (channel) => channel === 'get-chat-conversations' ? [] : { guidance: 'A normal answer.' });
  render(<SessionChatView />);
  await act(async () => listeners.get('session-init')?.({ sessionId: 'normal-chat', problemStatement: 'Conversation' }));
  expect(listeners.has('getting-started-open-chat')).toBe(false);
  fireEvent.change(screen.getByRole('textbox', { name: 'Message Coco' }), { target: { value: 'How does this work?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-chat-message', expect.objectContaining({ userText: 'How does this work?' })));
  expect(sendMessage).not.toHaveBeenCalledWith('getting-started-guide', expect.anything());
});

it('offers the generic HTML preview action for a completed HTML reply', async () => {
  invoke.mockImplementation(async (channel) => channel === 'get-chat-conversations' ? [] : { streamed: true });
  render(<SessionChatView />);
  await act(async () => listeners.get('session-init')?.({ sessionId: 'normal-chat', problemStatement: 'Conversation' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Message Coco' }), { target: { value: 'Make a web page' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('send-chat-message', expect.anything()));
  const request = invoke.mock.calls.find(([channel]) => channel === 'send-chat-message')?.[1];
  await act(async () => listeners.get('chat-stream-event')?.({ type: 'done', requestId: request.requestId, sessionId: 'normal-chat', guidance: '<!doctype html><html><body><main>Model page</main></body></html>' }));
  const preview = await screen.findByRole('button', { name: /Preview HTML page/i });
  expect(preview).toHaveStyle({ minHeight: '52px', minWidth: '260px' });
  fireEvent.click(preview);
  expect(sendMessage).toHaveBeenCalledWith('open-html-preview', expect.objectContaining({ html: expect.stringContaining('Model page') }));
});

it('shows only the selected tab and preserves the chat draft across navigation', async () => {
  render(<SessionChatView />);
  const draft = screen.getByPlaceholderText(/Ask Coco/);
  fireEvent.change(draft, { target: { value: 'Keep my thought here' } });
  expect(screen.getByText('Training task content')).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  expect(screen.getByText('Training task content')).not.toBeVisible();
  expect(draft).toBeVisible();
  expect(sendMessage).toHaveBeenCalledWith('toggle-float-window', {
    expanded: false,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  expect(screen.getByText('Training task content')).toBeVisible();
  expect(draft).not.toBeVisible();
  expect(draft).toHaveValue('Keep my thought here');
  expect(sendMessage).toHaveBeenCalledWith('toggle-float-window', {
    expanded: true,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.getByText('Training task content')).not.toBeVisible();
  expect(draft).toBeVisible();
  expect(draft).toHaveValue('Keep my thought here');
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get-profile'));
});

it('opens settings and training as separate pages without the chat pane', async () => {
  render(<SessionChatView />);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeVisible();
  expect(screen.getByText('Training task content')).not.toBeVisible();
  expect(screen.getByPlaceholderText(/Ask Coco/)).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  expect(screen.getByText('Training task content')).toBeVisible();
  expect(screen.getByPlaceholderText(/Ask Coco/)).not.toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Settings' })).toBeNull();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('get-profile'));
});

it('keeps history open while moving into it and dismisses it with Escape or pointer exit', async () => {
  render(<SessionChatView />);
  const chat = screen.getByRole('button', { name: 'Chat' });
  fireEvent.mouseEnter(chat);
  const history = await screen.findByRole('region', {
    name: 'Conversation history',
  });
  fireEvent.mouseLeave(chat, { relatedTarget: history });
  fireEvent.mouseEnter(history, { relatedTarget: chat });
  expect(history).toBeVisible();
  expect(screen.getByPlaceholderText(/Ask Coco/)).toBeVisible();
  await screen.findByText('Your past conversations will appear here.');
  fireEvent.keyDown(chat, { key: 'Escape' });
  expect(
    screen.queryByRole('region', { name: 'Conversation history' }),
  ).toBeNull();
  fireEvent.focus(chat);
  expect(
    await screen.findByRole('region', { name: 'Conversation history' }),
  ).toBeVisible();
  fireEvent.mouseLeave(chat.closest('.workspace-navigation')!);
  expect(
    screen.queryByRole('region', { name: 'Conversation history' }),
  ).toBeNull();
});

it('shows a retryable history error and loads saved sessions on retry', async () => {
  let attempts = 0;
  invoke.mockImplementation(async (channel) => {
    if (channel === 'get-chat-conversations') {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return [
        {
          sessionId: 'saved',
          title: 'Project ideas',
          updatedAt: 1753200000000,
          messages: [],
        },
      ];
    }
    return null;
  });
  render(<SessionChatView />);
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Chat' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('Project ideas')).toBeVisible();
  expect(
    screen.queryByText('Conversation history could not be loaded.'),
  ).toBeNull();
});

it('synchronizes native resizing and external training navigation', async () => {
  render(<SessionChatView />);
  await act(async () =>
    listeners.get('float-window-state')?.({ isFloat: true }),
  );
  expect(screen.getByText('Training task content')).not.toBeVisible();
  expect(screen.getByRole('button', { name: 'Expand' })).toBeVisible();
  await act(async () => listeners.get('open-training-panel')?.());
  expect(screen.getByText('Training task content')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Training tasks' }),
  ).toHaveAttribute('aria-current', 'page');
  expect(screen.getByPlaceholderText(/Ask Coco/)).not.toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  expect(screen.getByText('Training task content')).toBeVisible();
  expect(screen.getByPlaceholderText(/Ask Coco/)).not.toBeVisible();
});

it('switches from training to chat when opening a saved conversation', async () => {
  invoke.mockImplementation(async (channel) =>
    channel === 'get-chat-conversations'
      ? [
          {
            sessionId: 'saved',
            title: 'Earlier chat',
            updatedAt: 1753200000000,
            messages: [{ role: 'tutor', text: 'Your saved answer' }],
          },
        ]
      : null,
  );
  render(<SessionChatView />);
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  fireEvent.mouseEnter(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.getByText('Training task content')).toBeVisible();
  fireEvent.click(await screen.findByText('Earlier chat'));
  expect(screen.getByText('Your saved answer')).toBeVisible();
  expect(screen.getByText('Training task content')).not.toBeVisible();
});

it('reveals chat when a practice task starts a chat session', async () => {
  render(<SessionChatView />);
  fireEvent.click(screen.getByRole('button', { name: 'Training tasks' }));
  await act(async () =>
    listeners.get('session-init')?.({
      sessionId: 'practice',
      problemStatement: 'Practice together',
    }),
  );
  expect(screen.getByPlaceholderText(/Ask Coco/)).toBeVisible();
  expect(screen.getByText('Training task content')).not.toBeVisible();
});

it('keeps the game preview inside its own chat conversation', async () => {
  const state = { sessionId: 'game', version: 'v1', phase: 'play', tour: 'active', introAcknowledged: true, hasChanges: false, canUndo: false, error: null };
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'runner-state') return state;
    if (channel === 'runner-preview') return { state, html: '<html><body>Game</body></html>' };
    if (channel === 'get-chat-conversations') return [];
    return null;
  });
  render(<SessionChatView />);
  await act(async () => {
    listeners.get('session-init')?.({ sessionId: 'game' });
    listeners.get('runner-focus-composer')?.({ sessionId: 'game' });
  });
  expect(await screen.findByTitle('Your playable game', {}, {timeout: 12000})).toBeVisible();
  expect(screen.getByLabelText('Your game preview')).toContainElement(screen.getByTitle('Your playable game'));
  await act(async () => listeners.get('session-init')?.({ sessionId: 'another-chat' }));
  expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
});

it('requires a typed request and a chosen workspace before showing the game', async () => {
  let state: any = { sessionId: 'first-chat', version: 'v1', phase: 'play', tour: 'meet', introAcknowledged: false, hasChanges: false, canUndo: false, error: null };
  invoke.mockImplementation(async (channel: string, payload: any) => {
    if (channel === 'runner-state') return state;
    if (channel === 'runner-preview') return { state, html: '<html><body>Game</body></html>' };
    if (channel === 'get-chat-conversations') return [];
    if (channel === 'runner-action' && payload.action === 'request-build') {
      state = { ...state, starterBuild: 'waiting' };
      listeners.get('runner-state-changed')?.(state);
      return { state };
    }
    return null;
  });
  render(<SessionChatView />);
  await act(async () => {
    listeners.get('session-init')?.({ sessionId: 'first-chat' });
    listeners.get('runner-focus-composer')?.({ sessionId: 'first-chat' });
  });
  expect(await screen.findByText(/Hi, I’m Coco!/, {}, {timeout: 3000})).toBeVisible();
  expect(screen.queryByLabelText('Suggested replies')).not.toBeInTheDocument();
  expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
  const composer = screen.getByRole('textbox', { name: 'Message Coco' });
  fireEvent.change(composer, { target: { value: 'Let’s build a game' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
  expect(await screen.findByText(/When working with an agent on a project/, {}, {timeout: 12000})).toBeVisible();
  expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
  // Cancelling the native folder dialog leaves this same waiting state.
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Choose working folder' })));
  expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
  state = { ...state, starterBuild: 'building', buildActivity: [{ kind: 'tool', call: { id: 'write-1', name: 'write', arguments: {path: '/chosen/coco-game/theme.json'}, status: 'running' } }] };
  await act(async () => listeners.get('runner-state-changed')?.(state));
  expect(await screen.findByText(/I’m starting to build your game/, {}, {timeout: 12000})).toBeVisible();
  expect(screen.queryByTitle('Your playable game')).not.toBeInTheDocument();
  state = { ...state, starterBuild: 'ready', tour: 'active', introAcknowledged: true, workspaceDirectory: '/chosen/coco-game' };
  await act(async () => listeners.get('runner-state-changed')?.(state));
  expect(await screen.findByTitle('Your playable game', {}, {timeout: 12000})).toBeVisible();
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('save-chat-conversation', expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({id:'onboarding-build',activity:expect.any(Array)})]) })));
});

it('routes onboarding questions to the normal chat model without building a game', async () => {
  const state = { sessionId: 'first-chat', version: 'v1', phase: 'play', tour: 'meet', hasChanges: false, canUndo: false, error: null };
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'runner-state') return state;
    if (channel === 'get-chat-conversations') return [];
    if (channel === 'send-chat-message') return { guidance: 'You choose which folder I can work in.' };
    return null;
  });
  render(<SessionChatView />);
  await act(async () => {
    listeners.get('session-init')?.({ sessionId: 'first-chat' });
    listeners.get('runner-focus-composer')?.({ sessionId: 'first-chat' });
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Message Coco' }), { target: { value: 'Can you see every file on my computer?' } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
  expect(await screen.findByText('You choose which folder I can work in.')).toBeVisible();
  expect(invoke).not.toHaveBeenCalledWith('runner-action', expect.objectContaining({ action: 'request-build' }));
});

it('finishes the collaboration from a typed approval', async () => {
  const state = { sessionId:'game', version:'v2', phase:'review', tour:'active', hasChanges:true, canUndo:true, error:null };
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'runner-state') return state;
    if (channel === 'runner-preview') return {state, html:'<p>Game</p>'};
    if (channel === 'get-chat-conversations') return [];
    return {};
  });
  render(<SessionChatView />);
  await act(async () => {
    listeners.get('session-init')?.({sessionId:'game'});
    listeners.get('runner-focus-composer')?.({sessionId:'game'});
  });
  fireEvent.change(screen.getByRole('textbox', {name:'Message Coco'}), {target:{value:'looks good'}});
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Send'})));
  expect(invoke).toHaveBeenCalledWith('runner-action', {sessionId:'game',action:'finish'});
  expect(invoke).toHaveBeenCalledWith('runner-action', {sessionId:'game',action:'finish-setup'});
});

it('animates the greeting on explicit onboarding entry even when history arrives late', async () => {
  const greeting = 'Hi, I’m Coco! Let’s build a little game together so you can see how you can collaborate with AI agents. Type “Let’s build a game” below to get started. You can ask me questions here at any time.';
  const state = {sessionId:'fresh-entry',version:'v1',phase:'play',tour:'meet',hasChanges:false,canUndo:false,error:null};
  let restore: (value: unknown) => void = () => {};
  const history = new Promise(resolve => { restore = resolve; });
  invoke.mockImplementation(async (channel: string, payload: any) => {
    if (channel === 'runner-state') return state;
    if (channel === 'get-chat-conversations') return payload?.includeQuests ? history : [];
    return null;
  });
  render(<SessionChatView />);
  await act(async () => {
    listeners.get('session-init')?.({sessionId:state.sessionId});
    listeners.get('runner-focus-composer')?.({sessionId:state.sessionId,animateGreeting:true});
  });
  const bubble = screen.getByRole('group', {name:greeting});
  expect(bubble.textContent).not.toBe(greeting);
  await act(async () => restore([{sessionId:state.sessionId,problem:'Getting started',messages:[{id:'onboarding-hello',role:'tutor',text:greeting,ts:1}]}]));
  expect(screen.getByRole('group',{name:greeting}).textContent).not.toBe(greeting);
  await waitFor(() => expect(screen.getByRole('group',{name:greeting}).textContent).toBe(greeting), {timeout:12000});
  // Explicitly starting the same unfinished onboarding should replay its greeting.
  await act(async () => listeners.get('runner-focus-composer')?.({sessionId:state.sessionId,animateGreeting:true}));
  expect(screen.getByRole('group',{name:greeting}).textContent).not.toBe(greeting);
});
