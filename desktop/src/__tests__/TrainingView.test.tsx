import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import TrainingView from '../renderer/components/TrainingView';
import type { StudyState } from '../shared/study';
import type { PreAssessmentState } from '../shared/pre-assessment';

let me: StudyState;
let invoke: jest.Mock;
let assessments: PreAssessmentState;
let studentMode: boolean;
const completedAssessments = (): PreAssessmentState => ({
  complete: true,
  sets: {
    A: {
      set: 'A',
      score: 8,
      maxScore: 8,
      completedAt: '2026-09-23T00:00:00Z',
      answers: {},
    },
    E: {
      set: 'E',
      score: 4,
      maxScore: 4,
      completedAt: '2026-09-23T00:00:00Z',
      answers: { e1: 'answer', e2: 'source', e3: 'risk' },
    },
  },
});
beforeEach(() => {
  me = {
    user_id: 'alice',
    role: 'participant',
    tutoring_allowed: false,
    pre_assessments_complete: false,
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
  assessments = { complete: false, sets: { A: null, E: null } };
  studentMode = false;
  invoke = jest.fn(async (channel, ...args) => {
    if (channel === 'study-me') return me;
    if (channel === 'pre-assessment-state') return assessments;
    if (channel === 'pre-assessment-submit') {
      const set = args[0] as 'A' | 'E';
      const result = {
        set,
        score: set === 'A' ? 2 : 1,
        maxScore: set === 'A' ? 8 : 4,
        completedAt: '2026-09-23T00:00:00Z',
        answers: args[1] as Record<string, string>,
      };
      assessments.sets[set] = result;
      assessments.complete = Boolean(assessments.sets.A && assessments.sets.E);
      return result;
    }
    if (channel === 'study-student-mode') {
      if (typeof args[0] === 'boolean') studentMode = args[0];
      return {
        available: me.role !== 'participant',
        enabled: studentMode,
      };
    }
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

it('replaces evaluation downloads with two in-app pre-assessment challenges', async () => {
  me.started_at = null;
  render(<TrainingView />);
  expect(
    await screen.findByRole('heading', {
      name: 'Complete both pre-assessment challenges',
    }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole('tab', { name: /Challenge 1/ }),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Challenge 2/ })).toBeInTheDocument();
  expect(screen.queryByText(/Download Task 1 files/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start Day 1' })).toBeDisabled();
  expect(
    screen.getAllByRole('button', { name: 'Download task' })[0],
  ).toBeDisabled();
});

it('folds a completed pre-assessment into a struck-through completion row', async () => {
  assessments = completedAssessments();
  const { container } = render(<TrainingView />);

  expect(await screen.findByText('Completed')).toBeInTheDocument();
  const title = screen.getByRole('heading', {
    name: 'Complete both pre-assessment challenges',
  });
  expect(title.querySelector('s')).toBeInTheDocument();
  expect(container.querySelector('.pre-assessment-unlocked')).toBeNull();
  const details = screen.getByText('Completed').closest('details')!;
  expect(details).not.toHaveAttribute('open');

  fireEvent.click(screen.getByText('Completed').closest('summary')!);
  expect(details).toHaveAttribute('open');
  expect(
    await screen.findByRole('tab', { name: /Challenge 1/ }),
  ).toBeInTheDocument();
});

it('keeps downloads available without tutoring but locks future days', async () => {
  assessments = completedAssessments();
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
  await waitFor(() => expect(downloads[0]).toBeEnabled());
  expect(downloads[1]).toBeDisabled();
  fireEvent.click(downloads[0]);
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('study-download', 1));
  const firstTask = screen
    .getByRole('heading', { name: 'Task 1' })
    .closest('section')!;
  expect(
    screen.queryByText(
      /The tasks I worked on in today’s session were relevant/,
    ),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(firstTask).getByRole('button', { name: 'Submit task' }),
  );
  const reflection = await screen.findByRole('dialog', {
    name: 'Tell us about your practice',
  });
  expect(
    within(reflection).getByText(
      /The tasks I worked on in today’s session were relevant/,
    ),
  ).toBeInTheDocument();
  const submit = within(reflection).getByRole('button', {
    name: 'Submit reflection & add screenshot',
  });
  expect(submit).toBeDisabled();
  const ratings = within(reflection).getAllByRole('radio');
  for (let index = 0; index < ratings.length; index += 5)
    fireEvent.click(ratings[index]);
  within(reflection)
    .getAllByRole('textbox')
    .forEach((textbox, index) =>
      fireEvent.change(textbox, {
        target: { value: `Reflection answer ${index + 1}` },
      }),
    );
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() =>
    expect(invoke).toHaveBeenCalledWith(
      'study-complete',
      1,
      'alice',
      expect.objectContaining({
        q1: 1,
        q5: 1,
        q6: 'Reflection answer 1',
        q8: 'Reflection answer 3',
      }),
    ),
  );
  expect(
    await screen.findByText(
      'Level 1 complete — reflection and screenshot saved locally, and 100 XP earned.',
    ),
  ).toBeInTheDocument();
});

it('keeps Challenge 1 open to show its score after submission', async () => {
  render(<TrainingView />);
  const challenge = (
    await screen.findByRole('heading', {
      name: 'Conceptual Understanding',
    })
  ).closest('section')!;
  const radios = within(challenge).getAllByRole('radio');
  for (let index = 0; index < radios.length; index += 4) {
    fireEvent.click(radios[index]);
  }
  const submit = within(challenge).getByRole('button', {
    name: 'Finish Challenge 1 & see my score',
  });
  await waitFor(() => expect(submit).toBeEnabled());
  fireEvent.click(submit);

  expect(await screen.findByText('2 / 8')).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Conceptual Understanding' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Anti-Blind-Acceptance' }),
  ).not.toBeInTheDocument();
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
  assessments = completedAssessments();
  render(<TrainingView />);
  const administration = await screen.findByRole('button', {
    name: 'Administration',
  });
  await waitFor(() => expect(administration).toBeEnabled());
  fireEvent.click(administration);
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

it('lets an admin enter and exit the gated student experience', async () => {
  me.role = 'admin';
  render(<TrainingView />);

  const enter = await screen.findByRole('button', { name: 'Student mode' });
  fireEvent.click(enter);

  expect(
    await screen.findByRole('button', { name: 'Exit student mode' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Administration' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('button', { name: 'Download task' })[0],
  ).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Exit student mode' }));
  expect(
    await screen.findByRole('button', { name: 'Student mode' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Administration' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getAllByRole('button', { name: 'Download task' })[0],
    ).toBeEnabled(),
  );
});

it('protects the super admin in the UI too', async () => {
  me.role = 'super_admin';
  me.user_id = 'shunta-test';
  assessments = completedAssessments();
  render(<TrainingView />);
  const administration = await screen.findByRole('button', {
    name: 'Administration',
  });
  await waitFor(() => expect(administration).toBeEnabled());
  fireEvent.click(administration);
  await screen.findByText('Participant progress');
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'shunta-test' },
  });
  expect(screen.getByRole('button', { name: 'Remove admin' })).toBeDisabled();
});
