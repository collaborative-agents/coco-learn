import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthView from '../renderer/components/AuthView';

describe('participant authentication', () => {
  it('allows quitting before sign-in without submitting credentials', () => {
    const sendMessage = jest.fn();
    const invoke = jest.fn();
    (window as any).electron = { ipcRenderer: { invoke, sendMessage } };
    render(<AuthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Quit CoCo Learn' }));
    expect(sendMessage).toHaveBeenCalledWith('quit-from-auth');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('lets users reopen permissions without signing in', async () => {
    const invoke = jest.fn().mockResolvedValue({ success: true });
    (window as any).electron = {
      ipcRenderer: { invoke, sendMessage: jest.fn() },
    };
    render(<AuthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Permissions' }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('open-system-permissions'),
    );
  });
  it('shows an actionable message if reopening permissions fails', async () => {
    const invoke = jest.fn().mockRejectedValue(new Error('failed'));
    (window as any).electron = {
      ipcRenderer: { invoke, sendMessage: jest.fn() },
    };
    render(<AuthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Permissions' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Open System Settings manually',
    );
  });
  it('shows validation warnings in English', () => {
    (window as any).electron = {
      ipcRenderer: { invoke: jest.fn(), sendMessage: jest.fn() },
    };

    render(<AuthView />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your username.');
  });

  it('keeps users signed in by default and submits signup credentials', async () => {
    const invoke = jest.fn(async () => ({ success: true }));
    const sendMessage = jest.fn();
    (window as any).electron = { ipcRenderer: { invoke, sendMessage } };

    render(<AuthView />);

    expect(screen.getByLabelText(/Keep me signed in/)).toBeChecked();
    fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'participant-001' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password-123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('auth-signup', {
        participantId: 'participant-001',
        password: 'password-123',
        keepSignedIn: true,
      }),
    );
    expect(sendMessage).toHaveBeenCalledWith('authentication-ui-complete');
  });
});
