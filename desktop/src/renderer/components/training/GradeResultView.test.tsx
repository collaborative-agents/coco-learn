import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import GradeResultView from './GradeResultView';

const invoke = jest.fn();

const graded = {
  task_id: 'day-1',
  title: 'Day 1',
  status: 'graded',
  score: 84.5,
  max_score: 100,
  band: 'Strong',
  bonus: 0,
  sections: [{ label: 'Issues corrected', score: 60, max_score: 70 }],
  strengths: ['Named each correction.'],
  gaps: ['Cite the claim in paragraph 4.'],
  feedback: 'Solid editorial review.',
  corrected: false,
  correction_note: null,
};

beforeEach(() => {
  invoke.mockReset();
  (window as any).electron = { ipcRenderer: { invoke } };
});

afterEach(() => {
  jest.useRealTimers();
});

it('renders nothing before anything has been submitted', async () => {
  invoke.mockResolvedValue({
    task_id: 'day-1',
    title: 'Day 1',
    status: 'none',
  });
  const { container } = render(<GradeResultView taskId="day-1" />);
  await act(async () => undefined);
  expect(container).toBeEmptyDOMElement();
});

it('shows the score, breakdown and feedback without reporting controls', async () => {
  invoke.mockResolvedValue(graded);
  render(<GradeResultView taskId="day-1" />);
  expect(
    await screen.findByText('Your result: 84.5 / 100'),
  ).toBeInTheDocument();
  expect(screen.getByText('Strong')).toBeInTheDocument();
  expect(screen.getByText('Solid editorial review.')).toBeInTheDocument();
  expect(screen.getByText('60 / 70')).toBeInTheDocument();
  expect(screen.getByText('Named each correction.')).toBeInTheDocument();
  expect(
    screen.getByText('Cite the claim in paragraph 4.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/automated and may contain errors/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Report a problem' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Score breakdown' }),
  ).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith('study-grade', 'day-1');
});

it('keeps checking while grading and then shows the result', async () => {
  jest.useFakeTimers();
  invoke.mockResolvedValueOnce({
    ...graded,
    status: 'pending',
    score: undefined,
  });
  invoke.mockResolvedValueOnce(graded);
  render(<GradeResultView taskId="day-1" />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Grading…')).toBeInTheDocument();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(15_000);
  });
  expect(screen.getByText('Your result: 84.5 / 100')).toBeInTheDocument();
  const calls = invoke.mock.calls.length;
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60_000);
  });
  expect(invoke).toHaveBeenCalledTimes(calls);
});

it('shows a correction from the study team', async () => {
  invoke.mockResolvedValue({
    ...graded,
    corrected: true,
    correction_note: 'Reviewed by hand.',
  });
  render(<GradeResultView taskId="day-1" />);
  expect(await screen.findByText(/Reviewed by hand\./)).toBeInTheDocument();
});

it('keeps checking when an uploaded submission is not yet queued for grading', async () => {
  jest.useFakeTimers();
  invoke.mockResolvedValueOnce({ status: 'none' });
  invoke.mockResolvedValueOnce(graded);
  render(<GradeResultView taskId="day-1" awaitingSubmission />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('Grading…')).toBeInTheDocument();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(15_000);
  });
  expect(screen.getByText('Your result: 84.5 / 100')).toBeInTheDocument();
});
