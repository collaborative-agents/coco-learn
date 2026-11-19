import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import OnboardingView from '../renderer/components/OnboardingView';

function setup(
  overrides: Record<string, unknown> = {},
) {
  window.history.pushState({}, '', '/?view=onboarding');
  const responses: Record<string, unknown> = {
    'get-profile': null,
    'get-system-permissions': { missing: [] },
    'get-wake-word-settings': { enabled: false },
    'set-wake-word-settings': { success: true },
    ...overrides,
  };
  const invoke = jest.fn(async (channel: string) => responses[channel] ?? null);
  const sendMessage = jest.fn();
  const listeners: Record<string, (...args: unknown[]) => void> = {};
  const on = jest.fn(
    (channel: string, listener: (...args: unknown[]) => void) => {
      listeners[channel] = listener;
      return () => delete listeners[channel];
    },
  );
  (window as any).electron = { ipcRenderer: { invoke, sendMessage, on } };
  return { invoke, sendMessage, responses, listeners };
}
async function next() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  });
}
async function enterName() {
  await next();
  fireEvent.change(screen.getByLabelText('Your name or preferred nickname'), {
    target: { value: ' Ada ' },
  });
  await next();
}

describe('onboarding window', () => {
  beforeEach(() => jest.spyOn(window, 'close').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it('introduces Coco inside the welcome window without the stuck example', async () => {
    const {sendMessage, invoke} = setup();
    await act(async () => {render(<OnboardingView />);});
    expect(sendMessage).toHaveBeenCalledWith('onboarding-step', 'welcome');
    expect(screen.getByText(/I’m Coco, your floating desktop companion/)).toBeInTheDocument();
    expect(screen.queryByText(/Comparing options/)).not.toBeInTheDocument();
    expect(screen.queryByText('STUCK?')).not.toBeInTheDocument();
    await next();
    expect(sendMessage).toHaveBeenCalledWith('onboarding-step', 'name');
    expect(invoke).not.toHaveBeenCalledWith('runner-start');
  });

  it('completes signup onboarding without model setup or personal API keys', async () => {
    const { invoke, sendMessage } = setup();
    await act(async () => {
      render(<OnboardingView />);
    });
    expect(screen.getByRole('heading', {
      name: 'Meet Coco, your proactive co-assistant',
    })).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    await enterName();
    await next();
    await next();
    expect(screen.getByRole('heading', { name: 'Ready to go' })).toBeInTheDocument();
    expect(screen.getByText('5 / 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Coco' }));
    expect(sendMessage).toHaveBeenCalledWith('onboarding-complete',
      expect.objectContaining({ onboardingComplete: true }));
    expect(invoke).not.toHaveBeenCalledWith('save-model-configuration', expect.anything());
  });

  it('requires only a name and never reads or overwrites memory', async () => {
    const { invoke } = setup();
    await act(async () => {
      render(<OnboardingView />);
    });
    await next();
    await next();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the name');
    expect(
      screen.queryByText(/Example memories|Memory \(optional\)/),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your name or preferred nickname'), {
      target: { value: 'Ada' },
    });
    await next();
    expect(
      screen.getByRole('heading', { name: 'Permissions & privacy' }),
    ).toBeInTheDocument();
    expect(
      invoke.mock.calls.some(
        ([channel]) => channel === 'get-memory' || channel === 'save-memory',
      ),
    ).toBe(false);
  });

  it('waits for permissions and refreshes when returning from system settings', async () => {
    const { invoke, responses } = setup({
      'get-system-permissions': { missing: [{ target: 'screen-recording' }] },
      'open-system-permissions': { success: true },
    });
    await act(async () => {
      render(<OnboardingView />);
    });
    await enterName();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getByText('Privacy & your data')).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Grant access' }));
    });
    expect(invoke).toHaveBeenCalledWith(
      'open-system-permissions',
      'screen-recording',
    );
    responses['get-system-permissions'] = { missing: [] };
    await act(async () => {
      fireEvent.focus(window);
    });
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    await next();
    expect(
      screen.getByRole('switch', { name: 'Listen for Coco' }),
    ).not.toBeChecked();
    expect(screen.queryByText('Privacy & your data')).not.toBeInTheDocument();
  });

  it('keeps permissions blocked if their status cannot be loaded', async () => {
    const { responses } = setup({
      'get-system-permissions': null,
    });
    await act(async () => {
      render(<OnboardingView />);
    });
    await enterName();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not check permissions',
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.queryByText('Checking…')).not.toBeInTheDocument();
    expect(screen.getAllByText('Status unavailable')).toHaveLength(2);
    responses['get-system-permissions'] = { missing: [] };
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('handles microphone denial without enabling voice and allows continuing', async () => {
    const { invoke } = setup({
      'set-wake-word-settings': {
        success: false,
        error: 'Microphone access is required.',
      },
    });
    await act(async () => {
      render(<OnboardingView />);
    });
    await enterName();
    await next();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });
    expect(invoke).toHaveBeenCalledWith('set-wake-word-settings', {
      enabled: true,
    });
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Microphone access is required.',
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('confirms a wake phrase heard during setup instead of opening chat', async () => {
    const { listeners } = setup();
    await act(async () => {
      render(<OnboardingView />);
    });
    await enterName();
    await next();
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'));
    });
    expect(screen.getByText('Try it now: say “Hey Coco”.')).toBeVisible();
    await act(async () => {
      listeners['onboarding-wake-word-detected']();
    });
    expect(screen.getByText(/Coco heard you!/)).toBeVisible();
  });

  it.each([false, true])(
    'persists avatar hidden=%s with the existing profile payload',
    async (hidden) => {
      const { invoke, sendMessage } = setup();
      await act(async () => {
        render(<OnboardingView />);
      });
      await enterName();
      await next();
      await act(async () => {
        fireEvent.click(screen.getByRole('switch'));
      });
      expect(screen.getByRole('switch')).toBeChecked();
      await next();
      expect(screen.getByText('5 / 5')).toBeInTheDocument();
      expect(screen.queryByText('Your AI toolkit')).not.toBeInTheDocument();
      expect(
        screen.queryByText('How should Coco support you?'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: /Avatar \+ menu bar/ }),
      ).toBeChecked();
      expect(
        screen.getByRole('radiogroup', { name: 'Avatar visibility' }),
      ).toBeVisible();
      if (hidden)
        fireEvent.click(screen.getByRole('radio', { name: /Menu bar only/ }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      });
      expect(
        screen.getByRole('heading', { name: 'Hey Coco' }),
      ).toBeInTheDocument();
      expect(screen.getByText('4 / 5')).toBeInTheDocument();
      await next();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Start Coco' }));
      });
      expect(sendMessage).toHaveBeenCalledWith(
        'onboarding-complete',
        expect.objectContaining({
          onboardingComplete: true,
          userName: 'Ada',
          hideAvatar: hidden,
          tutorScenario: 'ai_upskilling',
          aiTools: [],
          customSystemPrompt: '',
        }),
      );
      expect(invoke).not.toHaveBeenCalledWith('save-memory', expect.anything());
      expect(window.close).toHaveBeenCalled();
    },
  );

  it('can be hidden temporarily during onboarding', async () => {
    const { sendMessage } = setup();
    await act(async () => {
      render(<OnboardingView />);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close setup for now' }));
    expect(sendMessage).toHaveBeenCalledWith('hide-onboarding');
  });
});
