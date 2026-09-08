import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FriendsView from '../renderer/components/FriendsView';

describe('Human chat', () => {
  let invoke: jest.Mock;
  beforeEach(() => {
    invoke = jest.fn(async (channel) => {
      if (channel === 'social-list-friendships') return {
        friends: [{ participant_id: 'bob', friendship_id: 'alice:bob', unread_count: 1 }], incoming: [], outgoing: [],
      };
      if (channel === 'social-list-messages') return { messages: [{ _id: 'msg', sender_id: 'bob', content: 'Hi Alice', created_at: '2026-09-09T00:00:00Z' }] };
      return {};
    });
    Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke } } });
  });

  it('sends to the selected friend, never to the tutor', async () => {
    render(<FriendsView onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: /bob/ }));
    expect(await screen.findByText('Hi Alice')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message to friend'), { target: { value: 'Hello Bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to friend' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('social-send-message', 'bob', 'Hello Bob'));
    expect(invoke.mock.calls.every(([channel]) => channel.startsWith('social-'))).toBe(true);
  });

  it('shows a backend failure rather than silently claiming success', async () => {
    invoke.mockRejectedValue(new Error('HTTP 404'));
    render(<FriendsView onClose={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 404');
  });

  it('requests a friend using their exact username', async () => {
    render(<FriendsView onClose={() => {}} />);
    await screen.findByRole('button', { name: /bob/ });
    fireEvent.change(screen.getByLabelText('Friend username'), { target: { value: 'charlie' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add friend' }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith('social-request-friend', 'charlie'));
  });
});
