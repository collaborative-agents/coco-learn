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

  it.each([
    [70, 180],
    [200, 240],
  ])(
    'sizes the window to a %ipx bubble so Coco can still reach the top',
    async (bubbleHeight, windowHeight) => {
      const offsetHeight = jest
        .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
        .mockImplementation(function offsetHeightOf(this: HTMLElement) {
          return this.classList.contains('observation-bubble')
            ? bubbleHeight
            : 0;
        });
      const { listeners } = setupMenuIpc();
      const { invoke } = window.electron!.ipcRenderer as any;

      render(<App />);
      act(() => {
        listeners.get('observation-update')?.({
          type: 'snapshot',
          observation: 'The user may have made an error.',
          status: 'mistake',
          ts: Date.now() / 1000,
        });
      });
      await waitFor(() =>
        expect(invoke).toHaveBeenLastCalledWith('resize-avatar-window', {
          width: 420,
          height: windowHeight,
        }),
      );
      offsetHeight.mockRestore();
    },
  );

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
