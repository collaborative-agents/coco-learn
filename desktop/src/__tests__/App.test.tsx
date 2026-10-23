import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import App from '../renderer/App';

// The bubble most recently sent to the bubble window.
const lastBubbleState = (sendMessage: jest.Mock) =>
  sendMessage.mock.calls
    .filter(([channel]) => channel === 'avatar-bubble-state')
    .at(-1)?.[1]?.bubble;

const mistakeEvent = () => ({
  type: 'snapshot',
  observation: 'The user may have made an error.',
  status: 'mistake',
  ts: Date.now() / 1000,
});

describe('App', () => {
  it('should render', () => {
    expect(render(<App />)).toBeTruthy();
  });

  it('shows a calm bubble only when Coco moves into a calm status', () => {
    jest.useFakeTimers();
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
    const observe = (status: string) =>
      act(() => {
        listeners.get('observation-update')?.({
          type: 'snapshot',
          observation: 'The user is working on a report.',
          status,
          ts: Date.now() / 1000,
        });
      });
    const letBubbleFade = () =>
      act(() => {
        jest.advanceTimersByTime(30_000);
      });

    observe('progress');
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'progress' }),
    );
    letBubbleFade();
    expect(lastBubbleState(sendMessage)).toBeNull();

    observe('progress');
    expect(lastBubbleState(sendMessage)).toBeNull();
    // Only the fox follows a repeated calm status, and only for a while.
    const fox = document.getElementById('pet-image');
    expect(fox).not.toHaveClass('pet-image-awake');
    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(fox).toHaveClass('pet-image-awake');

    observe('observing');
    expect(lastBubbleState(sendMessage)).toBeNull();

    observe('stuck');
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'stuck' }),
    );
    observe('progress');
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'progress' }),
    );
    jest.useRealTimers();
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
    const { sendMessage } = window.electron!.ipcRenderer as any;
    act(() => listeners.get('observation-update')?.(mistakeEvent()));
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'mistake' }),
    );

    act(() => listeners.get('system-suspend')?.());
    expect(lastBubbleState(sendMessage)).toBeNull();
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
    const { sendMessage } = window.electron!.ipcRenderer as any;
    act(() => listeners.get('observation-update')?.(mistakeEvent()));
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'mistake' }),
    );

    act(() =>
      listeners.get('post-assessment-proactive-suppression')?.({
        active: true,
      }),
    );
    expect(lastBubbleState(sendMessage)).toBeNull();
  });

  const setupMenuIpc = (
    invoke: jest.Mock = jest.fn().mockResolvedValue({ sleeping: false }),
  ) => {
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
        invoke,
      },
    };
    const chooseMenuItem = (action: string) =>
      act(() => listeners.get('avatar-menu-action')?.(action));
    return { sendMessage, listeners, chooseMenuItem };
  };

  it('sends a new bubble to its own window without resizing the avatar', () => {
    const { listeners, sendMessage } = setupMenuIpc();
    const { invoke } = window.electron!.ipcRenderer as any;

    render(<App />);
    act(() => listeners.get('observation-update')?.(mistakeEvent()));

    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({
        status: 'mistake',
        phrase: expect.any(String),
      }),
    );
    expect(invoke).not.toHaveBeenCalledWith(
      'resize-avatar-window',
      expect.anything(),
    );
  });

  it('lets bubbles through again after sleeping with a suggestion open', async () => {
    const suggestion = {
      kind: 'content',
      title: 'Try a smaller example',
      body: 'Reduce the input first.',
      copyText: 'Reduce the input first.',
    };
    const invoke = jest.fn(async (channel: string, payload?: any) => {
      if (channel === 'get-instant-suggestion')
        return { status: 'ready', suggestion, scenario: 'everyday_support' };
      if (channel === 'set-coco-sleep-mode')
        return { success: true, sleeping: payload?.sleeping };
      return { sleeping: false };
    });
    const { listeners, sendMessage, chooseMenuItem } = setupMenuIpc(invoke);
    render(<App />);
    act(() => listeners.get('observation-update')?.(mistakeEvent()));
    // Reveal the suggestion, which pins the bubble.
    await act(async () => {
      listeners.get('avatar-bubble-event')?.('help');
    });
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ suggestion }),
    );

    await act(async () => chooseMenuItem('toggle-sleep'));
    expect(lastBubbleState(sendMessage)).toBeNull();
    await act(async () => chooseMenuItem('toggle-sleep'));

    act(() =>
      listeners.get('observation-update')?.({
        ...mistakeEvent(),
        observation: 'A new observation after waking.',
        status: 'stuck',
      }),
    );
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'stuck' }),
    );
  });

  it('hides the ••• trigger while Coco is dragged', () => {
    const { listeners } = setupMenuIpc();
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'More actions' });
    const container = trigger.closest('.pet-container');
    expect(container).not.toHaveClass('is-dragging');

    act(() => listeners.get('avatar-dragging')?.({ dragging: true }));
    expect(container).toHaveClass('is-dragging');
    act(() => listeners.get('avatar-dragging')?.({ dragging: false }));
    expect(container).not.toHaveClass('is-dragging');
  });

  it('handles clicks and hovers from the bubble window', async () => {
    jest.useFakeTimers();
    const { listeners, sendMessage } = setupMenuIpc();
    render(<App />);
    act(() => listeners.get('observation-update')?.(mistakeEvent()));
    const bubbleEvent = (type: string) =>
      act(() => listeners.get('avatar-bubble-event')?.(type));

    // Hovering pauses the auto-hide.
    bubbleEvent('enter');
    act(() => jest.advanceTimersByTime(60_000));
    expect(lastBubbleState(sendMessage)).toEqual(
      expect.objectContaining({ status: 'mistake', fadingOut: false }),
    );

    bubbleEvent('dismiss');
    expect(sendMessage).toHaveBeenCalledWith(
      'training-feedback',
      expect.objectContaining({ kind: 'dismiss', status: 'mistake' }),
    );
    act(() => jest.advanceTimersByTime(1_000));
    expect(lastBubbleState(sendMessage)).toBeNull();
    jest.useRealTimers();
  });

  it('keeps Coco asleep on avatar click and wakes it from the menu', async () => {
    const invoke = jest.fn(
      (channel: string, payload?: { sleeping?: boolean }) => {
        if (channel === 'get-coco-sleep-mode') {
          return Promise.resolve({ sleeping: false });
        }
        return Promise.resolve({ success: true, sleeping: payload?.sleeping });
      },
    );
    const { sendMessage, chooseMenuItem } = setupMenuIpc(invoke);

    render(<App />);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get-coco-sleep-mode');
    });
    chooseMenuItem('toggle-sleep');
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set-coco-sleep-mode', {
        sleeping: true,
      });
    });

    // Let the sleep result settle before interacting again.
    await act(async () => {});
    fireEvent.click(screen.getByAltText('Desktop Pet'));
    expect(sendMessage).not.toHaveBeenCalledWith('open-main-window');
    expect(invoke).not.toHaveBeenCalledWith('set-coco-sleep-mode', {
      sleeping: false,
    });

    chooseMenuItem('toggle-sleep');
    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('set-coco-sleep-mode', {
        sleeping: false,
      });
    });
  });

  it('asks main to open the menu from the ••• button and a right-click', () => {
    const { sendMessage, listeners } = setupMenuIpc();

    render(<App />);
    expect(screen.getByText('Right-click for menu')).toBeInTheDocument();
    const trigger = screen.getByTitle('More actions');
    fireEvent.click(trigger);
    expect(sendMessage).toHaveBeenCalledWith('open-avatar-menu');

    sendMessage.mockClear();
    fireEvent.contextMenu(
      screen.getByAltText('Desktop Pet').closest('.pet-container')!,
    );
    expect(sendMessage).toHaveBeenCalledWith('open-avatar-menu');

    act(() => listeners.get('avatar-menu-visibility')?.({ open: true }));
    expect(trigger).toHaveClass('is-open');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    act(() => listeners.get('avatar-menu-visibility')?.({ open: false }));
    expect(trigger).not.toHaveClass('is-open');
  });

  it('runs the navigation and Quit items chosen in the menu window', () => {
    const { sendMessage, chooseMenuItem } = setupMenuIpc();

    render(<App />);
    chooseMenuItem('open-main-window');
    expect(sendMessage).toHaveBeenCalledWith('open-main-window');
    chooseMenuItem('open-training');
    expect(sendMessage).toHaveBeenCalledWith('open-training');
    chooseMenuItem('open-chat-settings');
    expect(sendMessage).toHaveBeenCalledWith('open-chat-settings');
    chooseMenuItem('quit');
    expect(sendMessage).toHaveBeenCalledWith('quit-from-avatar');
  });
});
