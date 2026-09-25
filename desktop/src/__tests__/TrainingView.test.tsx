import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TrainingView from '../renderer/components/TrainingView';
import type { StudyState } from '../shared/study';

let me: StudyState;
let invoke: jest.Mock;
beforeEach(() => {
  me = {
    user_id: 'alice',
    role: 'participant',
    tutoring_allowed: false,
    started_at: '2026-09-24T00:00:00Z',
    timezone: 'Asia/Tokyo',
    days: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      title: `Task ${index + 1}`,
      available: true,
      filename: 'task.pdf',
      unlocked: index === 0,
      unlocks_at: null,
      completed_at: null,
    })),
  };
  invoke = jest.fn(async (channel) => {
    if (channel === 'study-me') return me;
    if (channel === 'study-admin-users')
      return { users: [me], next_after: null };
    return { success: true };
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke } },
  });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => jest.restoreAllMocks());

it('keeps downloads available without tutoring but locks future days', async () => {
  render(<TrainingView />);
  await screen.findByText('Task 1');
  expect(screen.getByText(/AI tutoring is disabled/)).toBeInTheDocument();
  expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  const downloads = screen.getAllByRole('button', { name: 'Download task' });
  expect(downloads[0]).toBeEnabled();
  expect(downloads[1]).toBeDisabled();
  fireEvent.click(downloads[0]);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('study-download', 1));
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('study-complete', 1));
});

it('does not begin training while materials are missing', async () => {
  me.started_at = null;
  me.days[0].available = false;
  render(<TrainingView />);
  expect(
    await screen.findByRole('button', { name: 'Materials are being prepared' }),
  ).toBeDisabled();
});

it('shows progress to admins but reserves role changes for the super admin', async () => {
  me.role = 'admin';
  render(<TrainingView />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Administration' }),
  );
  await screen.findByText('Participant progress');
  expect(
    screen.queryByRole('button', { name: 'Add admin' }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'bob' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Disable tutoring' }));
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith('study-admin-tutoring', 'bob', true),
  );
});

it('protects the super admin in the UI too', async () => {
  me.role = 'super_admin';
  me.user_id = 'shunta-test';
  render(<TrainingView />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Administration' }),
  );
  await screen.findByText('Participant progress');
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'shunta-test' },
  });
  expect(screen.getByRole('button', { name: 'Remove admin' })).toBeDisabled();
});
