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

it('offers baseline files before enrollment even without tutoring', async () => {
  me.started_at = null;
  me.evaluation_tasks = [1, 2].map((task) => ({ task, available: true, filename: `Task${task}.zip` }));
  render(<TrainingView />);
  const download = await screen.findByRole('button', { name: 'Download Task 1 files' });
  expect(download).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Download Task 2 files' })).toBeEnabled();
  fireEvent.click(download);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('study-evaluation-download', 1));
  expect(invoke).not.toHaveBeenCalledWith('study-start', expect.anything());
});

it('does not offer downloads when an older server omits evaluation materials', async () => {
  render(<TrainingView />);
  expect(await screen.findByRole('button', { name: 'Download Task 1 files' })).toBeDisabled();
});

it('keeps downloads available without tutoring but locks future days', async () => {
  render(<TrainingView />);
  await screen.findByText('Task 1');
  expect(
    screen.getByRole('heading', { name: 'Camp awards' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /Finish all seven daily tasks.*pre- and post-assessments/s,
    ),
  ).toBeInTheDocument();
  expect(screen.getByText(/Top Performer/)).toBeInTheDocument();
  expect(screen.getByText(/AI tutoring is disabled/)).toBeInTheDocument();
  expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  const downloads = screen.getAllByRole('button', { name: 'Download task' });
  expect(downloads[0]).toBeEnabled();
  expect(downloads[1]).toBeDisabled();
  fireEvent.click(downloads[0]);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('study-download', 1));
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Add screenshot & complete' })[0],
  );
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith('study-complete', 1, 'alice'),
  );
  expect(
    await screen.findByText(
      'Level 1 complete — screenshot saved locally and 100 XP earned.',
    ),
  ).toBeInTheDocument();
});

it('shows progress as a seven-level journey with Coco at the current level', async () => {
  me.days[0].completed_at = '2026-09-24T01:00:00Z';
  me.days[1].unlocked = true;

  const { container } = render(<TrainingView />);

  expect(await screen.findByText('Level 2 of 7')).toBeInTheDocument();
  expect(screen.getByLabelText('100 experience points')).toBeInTheDocument();
  expect(screen.getByLabelText('Level 1: done')).toBeInTheDocument();
  expect(screen.getByLabelText('Level 2: current')).toBeInTheDocument();
  expect(screen.getByLabelText('Level 3: locked')).toBeInTheDocument();
  expect(
    screen.getByRole('progressbar', { name: 'Training journey progress' }),
  ).toHaveAttribute('aria-valuenow', '14');
  expect(container.querySelector('.training-runner img')).toHaveAttribute(
    'src',
    'test-file-stub',
  );
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
