import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TrainingDialog from './TrainingDialog';
import TrainingTaskDetail from './TrainingTaskDetail';
import type { TrainingDay } from '../../../shared/study';

jest.mock('./TrainingDocumentView', () => ({
  __esModule: true,
  default: () => <p>Task brief</p>,
}));
jest.mock('./TrainingSubmissionView', () => ({
  __esModule: true,
  default: () => <p>Completed submission</p>,
}));
const invoke = jest.fn();
const reflect = jest.fn();
const day = {
  day: 1,
  completed_at: null,
  deliverable_required: true,
  submitted_files: [],
} as unknown as TrainingDay;
const grade = { status: 'graded', score: 80, max_score: 100 };
beforeEach(() => {
  invoke.mockReset();
  reflect.mockReset();
  (window as any).electron = { ipcRenderer: { invoke } };
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'study-task-materials') return { documents: [], files: [] };
    if (channel === 'study-submission-attempts') return { attempts: [] };
    if (channel === 'study-grade') return grade;
    return { filenames: ['report.pdf'] };
  });
});

it('submits, shows results, allows resubmission, and reflects only on finish', async () => {
  render(
    <TrainingTaskDetail
      userId={expect.getState().currentTestName!}
      day={day}
      busy={false}
      onReflect={reflect}
    />,
  );
  expect(
    screen.queryByRole('button', { name: 'Mark as finished' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit work' }));
  expect(await screen.findByText('Your result: 80 / 100')).toBeInTheDocument();
  expect(reflect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit again' }));
  await waitFor(() =>
    expect(
      invoke.mock.calls.filter(
        ([channel]) => channel === 'study-submit-deliverable',
      ),
    ).toHaveLength(2),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Mark as finished' }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Mark as finished' }));
  expect(reflect).toHaveBeenCalledTimes(1);
});

it('does not advance after cancellation or a rejected upload', async () => {
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'study-task-materials') return { documents: [], files: [] };
    return { canceled: true };
  });
  render(
    <TrainingTaskDetail
      userId={expect.getState().currentTestName!}
      day={day}
      busy={false}
      onReflect={reflect}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit work' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Submit work' })).toBeEnabled(),
  );
  expect(
    screen.queryByRole('button', { name: 'Mark as finished' }),
  ).not.toBeInTheDocument();
  invoke.mockRejectedValueOnce(new Error('No readable text'));
  fireEvent.click(screen.getByRole('button', { name: 'Submit work' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No readable text',
  );
  expect(reflect).not.toHaveBeenCalled();
});

it('restores the results and resubmit action for previously uploaded files', async () => {
  render(
    <TrainingTaskDetail
      userId={expect.getState().currentTestName!}
      day={{ ...day, submitted_files: ['memo.pdf'] }}
      busy={false}
      onReflect={reflect}
    />,
  );
  expect(await screen.findByText('Your result: 80 / 100')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit again' })).toBeEnabled();
});

it('navigates from submission to instructions using the header back button and returns without submitting', async () => {
  render(
    <TrainingDialog open title="Practice task" onClose={jest.fn()}>
      <TrainingTaskDetail
        userId={expect.getState().currentTestName!}
        day={{ ...day, submitted_files: ['memo.pdf'] }}
        busy={false}
        onReflect={reflect}
      />
    </TrainingDialog>,
  );
  expect(await screen.findByText('Your result: 80 / 100')).toBeInTheDocument();
  const back = screen.getByRole('button', {
    name: 'Back to task instructions',
  });
  expect(back.closest('.training-dialog-actions')).toContainElement(
    screen.getByRole('button', { name: 'Close task details' }),
  );
  expect(
    screen.queryByRole('button', { name: 'View task instructions' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/When you’re ready/)).not.toBeInTheDocument();
  fireEvent.click(back);
  expect(screen.queryByText('Your result: 80 / 100')).not.toBeInTheDocument();
  expect(
    screen
      .getByRole('button', { name: 'View submission' })
      .closest('.training-dialog-actions'),
  ).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View submission' }));
  expect(await screen.findByText('Your result: 80 / 100')).toBeInTheDocument();
  expect(
    invoke.mock.calls.some(
      ([channel]) => channel === 'study-submit-deliverable',
    ),
  ).toBe(false);
});
