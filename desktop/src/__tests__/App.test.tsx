import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '../renderer/App';

describe('App', () => {
  it('hides the avatar from the three-dot menu without sleeping or quitting', async () => {
    const invoke = jest.fn().mockResolvedValue({ success: true });
    const sendMessage = jest.fn();
    (window as any).electron = { ipcRenderer: { on: jest.fn(() => jest.fn()), invoke, sendMessage } };
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('update-avatar-visibility', { hideAvatar: true }));
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    expect(invoke.mock.calls.some(([channel]) => channel === 'set-coco-sleep-mode')).toBe(false);
  });

  it('keeps the menu open when hiding fails', async () => {
    const invoke = jest.fn(async (channel) => channel === 'update-avatar-visibility' ? { success: false } : []);
    (window as any).electron = { ipcRenderer: { on: jest.fn(() => jest.fn()), invoke, sendMessage: jest.fn() } };
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not hide Coco');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });

  it('clears an observation bubble when the system suspends', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    (window as any).electron = {
      ipcRenderer: {
        on: (channel: string, callback: (...args: unknown[]) => void) => {
          listeners.set(channel, callback);
          return () => listeners.delete(channel);
        },
        sendMessage: jest.fn(),
        invoke: jest.fn().mockResolvedValue([]),
      },
    };

    render(<App />);
    await waitFor(() => {
      expect(window.electron?.ipcRenderer.invoke).toHaveBeenCalledWith(
        'get-coco-sleep-mode',
      );
    });
    act(() => {
      listeners.get('observation-update')?.({
        type: 'snapshot',
        observation: 'The user may have made an error.',
        status: 'mistake',
        ts: Date.now() / 1000,
      });
    });
    expect(screen.getByText('Heads up')).toBeInTheDocument();

    act(() => listeners.get('system-suspend')?.());
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });

  it('clears proactive UI when the post-assessment starts', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    (window as any).electron = {
      ipcRenderer: {
        on: (channel: string, callback: (...args: unknown[]) => void) => {
          listeners.set(channel, callback);
          return () => listeners.delete(channel);
        },
        sendMessage: jest.fn(),
        invoke: jest.fn().mockResolvedValue([]),
      },
    };

    render(<App />);
    act(() => {
      listeners.get('observation-update')?.({
        type: 'snapshot',
        observation: 'The user may have made an error.',
        status: 'mistake',
        ts: Date.now() / 1000,
      });
    });
    expect(screen.getByText('Heads up')).toBeInTheDocument();

    act(() =>
      listeners.get('post-assessment-proactive-suppression')?.({
        active: true,
      }),
    );
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();
  });

  it('keeps Coco asleep on avatar click and wakes it from the menu', async () => {
    const sendMessage = jest.fn();
    const invoke = jest.fn(
      (channel: string, payload?: { sleeping?: boolean }) => {
        if (channel === 'get-coco-sleep-mode') {
          return Promise.resolve({ sleeping: false });
        }
        return Promise.resolve({ success: true, sleeping: payload?.sleeping });
      },
    );
    (window as any).electron = {
      ipcRenderer: {
        on: jest.fn(() => jest.fn()),
        sendMessage,
        invoke,
      },
    };

    render(<App />);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get-coco-sleep-mode');
    });
    fireEvent.click(screen.getByTitle('More actions'));
    fireEvent.click(screen.getByText('Sleep'));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set-coco-sleep-mode', {
        sleeping: true,
      });
    });

    fireEvent.click(screen.getByAltText('Desktop Pet'));
    expect(sendMessage).not.toHaveBeenCalledWith('open-main-window');
    expect(invoke).not.toHaveBeenCalledWith('set-coco-sleep-mode', {
      sleeping: false,
    });

    fireEvent.click(screen.getByTitle('More actions'));
    fireEvent.click(screen.getByText('Wake Coco'));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set-coco-sleep-mode', {
        sleeping: false,
      });
    });
  });

  it('opens the action menu when the avatar is right-clicked', () => {
    const sendMessage = jest.fn();
    const listeners = new Map<string, (...args: unknown[]) => void>();
    (window as any).electron = {
      ipcRenderer: {
        on: jest.fn(
          (channel: string, callback: (...args: unknown[]) => void) => {
            listeners.set(channel, callback);
            return () => listeners.delete(channel);
          },
        ),
        sendMessage,
        invoke: jest.fn().mockResolvedValue({ sleeping: false }),
      },
    };

    render(<App />);
    expect(screen.getByText('Right-click for menu')).toBeInTheDocument();
    const avatarContainer = screen
      .getByAltText('Desktop Pet')
      .closest('.pet-container');
    expect(avatarContainer).not.toBeNull();

    fireEvent.contextMenu(avatarContainer!);
    expect(
      screen.getByRole('menu', { name: 'Coco actions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Open Chat')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('More actions'));
    act(() => listeners.get('open-avatar-actions-menu')?.());
    expect(
      screen.getByRole('menu', { name: 'Coco actions' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open Chat'));
    expect(sendMessage).toHaveBeenCalledWith('open-main-window');
  });

  it('offers consistent navigation and Quit, without History', async () => {
    const sendMessage = jest.fn();
    (window as any).electron = {
      ipcRenderer: {
        on: jest.fn(() => jest.fn()),
        sendMessage,
        invoke: jest.fn((channel: string) =>
          Promise.resolve(
            channel === 'get-coco-sleep-mode' ? { sleeping: false } : [],
          ),
        ),
      },
    };

    render(<App />);
    await waitFor(() => {
      expect(window.electron?.ipcRenderer.invoke).toHaveBeenCalledWith(
        'get-coco-sleep-mode',
      );
    });
    fireEvent.click(screen.getByTitle('More actions'));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Open Chat', 'Training', 'Settings', 'Hide', 'Sleep', 'Quit',
    ]);
    expect(screen.queryByRole('menuitem', { name: /History/i })).not.toBeInTheDocument();
    const trainingItem = screen.getByRole('menuitem', { name: 'Training' });
    expect(trainingItem).toHaveClass('pet-training-action');
    expect(
      trainingItem.querySelector('.pet-menu-icon--training'),
    ).toBeInTheDocument();
    fireEvent.click(trainingItem);
    expect(sendMessage).toHaveBeenCalledWith('open-training');

    fireEvent.click(screen.getByTitle('More actions'));
    fireEvent.click(screen.getByText('Settings'));
    expect(sendMessage).toHaveBeenCalledWith('open-chat-settings');

    fireEvent.click(screen.getByTitle('More actions'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quit' }));
    expect(sendMessage).toHaveBeenCalledWith('quit-from-avatar');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the contextual action menu when the avatar window loses focus', async () => {
    (window as any).electron = {
      ipcRenderer: {
        on: jest.fn(() => jest.fn()),
        sendMessage: jest.fn(),
        invoke: jest.fn().mockResolvedValue({ sleeping: false }),
      },
    };

    render(<App />);
    await waitFor(() => {
      expect(window.electron?.ipcRenderer.invoke).toHaveBeenCalledWith(
        'get-coco-sleep-mode',
      );
    });
    fireEvent.click(screen.getByTitle('More actions'));
    expect(
      screen.getByRole('menu', { name: 'Coco actions' }),
    ).toBeInTheDocument();

    fireEvent.blur(window);
    expect(
      screen.queryByRole('menu', { name: 'Coco actions' }),
    ).not.toBeInTheDocument();
  });
});

describe('session invite bubble', () => {
  const setup = () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const sendMessage = jest.fn();
    (window as any).electron = {
      ipcRenderer: {
        on: (channel: string, callback: (...args: unknown[]) => void) => {
          listeners.set(channel, callback);
          return () => listeners.delete(channel);
        },
        sendMessage,
        invoke: jest.fn().mockResolvedValue([]),
      },
    };
    render(<App />);
    act(() => {
      listeners.get('session-invite')?.({
        inviteId: 'invite-1',
        taskLabel: 'Drafting a social media thread',
      });
    });
    return { listeners, sendMessage };
  };

  it('shows the detected task and confirms it is on screen', () => {
    const { sendMessage } = setup();
    expect(screen.getByText('Support available')).toBeInTheDocument();
    expect(
      screen.getByText('Drafting a social media thread'),
    ).toBeInTheDocument();
    expect(sendMessage).toHaveBeenCalledWith('session-invite-shown', {
      inviteId: 'invite-1',
    });
  });

  it('starts the session from "Help me with this"', () => {
    const { sendMessage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Help me with this' }));
    expect(sendMessage).toHaveBeenCalledWith('session-invite-response', {
      inviteId: 'invite-1',
      outcome: 'accepted',
    });
    expect(screen.queryByText('Support available')).not.toBeInTheDocument();
  });

  it('reports a dismissal instead of training feedback', () => {
    const { sendMessage } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(sendMessage).toHaveBeenCalledWith('session-invite-response', {
      inviteId: 'invite-1',
      outcome: 'dismissed',
    });
    expect(
      sendMessage.mock.calls.some(
        ([channel]) => channel === 'training-feedback',
      ),
    ).toBe(false);
  });

  it('stays up through new observations until main clears it', () => {
    const { listeners } = setup();
    act(() => {
      listeners.get('observation-update')?.({
        type: 'snapshot',
        observation: 'The user may have made an error.',
        status: 'mistake',
        ts: Date.now() / 1000,
      });
    });
    expect(screen.getByText('Support available')).toBeInTheDocument();
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument();

    act(() => listeners.get('session-invite-clear')?.({ inviteId: 'other' }));
    expect(screen.getByText('Support available')).toBeInTheDocument();
    act(() =>
      listeners.get('session-invite-clear')?.({ inviteId: 'invite-1' }),
    );
    expect(screen.queryByText('Support available')).not.toBeInTheDocument();
  });

  it('hands a second invite back to main while the bubble is pinned', () => {
    const { listeners, sendMessage } = setup();
    act(() => {
      listeners.get('session-invite')?.({
        inviteId: 'invite-2',
        taskLabel: 'Something else',
      });
    });
    expect(sendMessage).toHaveBeenCalledWith('session-invite-busy', {
      inviteId: 'invite-2',
    });
    expect(
      screen.getByText('Drafting a social media thread'),
    ).toBeInTheDocument();
  });
});

describe('session invite with a suggestion preview', () => {
  const suggestion = {
    kind: 'content',
    title: 'Draft social media thread',
    body: 'Open with the main result, then one post per idea.',
    copyText: 'Open with the main result, then one post per idea.',
  };

  it('opens the preview in place and starts the session from chat', async () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const sendMessage = jest.fn();
    const invoke = jest.fn(async (channel: string) =>
      channel === 'get-instant-suggestion'
        ? { status: 'ready', suggestion, scenario: 'everyday_support' }
        : [],
    );
    (window as any).electron = {
      ipcRenderer: {
        on: (channel: string, callback: (...args: unknown[]) => void) => {
          listeners.set(channel, callback);
          return () => listeners.delete(channel);
        },
        sendMessage,
        invoke,
      },
    };
    render(<App />);
    act(() => {
      listeners.get('session-invite')?.({
        inviteId: 'invite-1',
        taskLabel: 'Announcing a blog post',
        observationId: 'invite-obs-1',
        rawObservation: 'The user is finishing a blog post.',
        suggestionTitle: 'Draft social media thread',
      });
    });
    expect(screen.getByText('Support available')).toBeInTheDocument();
    expect(screen.getByText('Draft social media thread')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Help me with this' }));
    expect(
      await screen.findByText(
        'Open with the main result, then one post per idea.',
      ),
    ).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith('get-instant-suggestion', {
      observationId: 'invite-obs-1',
    });
    expect(sendMessage).toHaveBeenCalledWith('session-invite-revealed', {
      inviteId: 'invite-1',
    });
    expect(sendMessage).not.toHaveBeenCalledWith(
      'session-invite-response',
      expect.anything(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chat with Coco' }));
    expect(sendMessage).toHaveBeenCalledWith(
      'chat-about-suggestion',
      expect.objectContaining({
        observationId: 'invite-obs-1',
        sessionInviteId: 'invite-1',
        suggestion,
      }),
    );
  });
});
