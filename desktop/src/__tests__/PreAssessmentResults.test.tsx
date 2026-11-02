import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import PreAssessmentPanel from '../renderer/components/PreAssessmentPanel';

const invoke = jest.fn();
const setA = {
  set: 'A',
  score: 7,
  maxScore: 8,
  completedAt: '2026-10-01T00:00:00Z',
  answers: { 1: 'A', 2: 'C', 3: 'B', 4: 'C', 5: 'C', 6: 'B', 7: 'C', 8: 'C' },
};
const setE = {
  set: 'E',
  score: null,
  maxScore: 4,
  completedAt: '2026-10-01T00:00:00Z',
  answers: { e1: 'one', e2: 'two', e3: 'three' },
};

beforeEach(() => {
  invoke.mockReset();
  (window as any).electron = { ipcRenderer: { invoke } };
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'pre-assessment-state')
      return { complete: true, sets: { A: setA, E: setE } };
    if (channel === 'study-grade')
      return { task_id: 'set-e', title: 'Challenge 2', status: 'pending' };
    return null;
  });
});

const panel = () =>
  render(<PreAssessmentPanel onCompletionChange={jest.fn()} />);

it('shows Set A answers and rationales from the app', async () => {
  panel();
  expect(await screen.findByText('7 / 8')).toBeInTheDocument();
  expect(screen.getByText(/Hallucinations are plausible/)).toBeInTheDocument();
  expect(screen.getAllByText('Answer: B.')).toHaveLength(3);
  expect(screen.getByText(/Your answer was A\./)).toBeInTheDocument();
});

it('keeps earlier completions without showing the removed challenge', async () => {
  panel();
  fireEvent.click(await screen.findByRole('tab', { name: /Execution task/ }));
  expect(
    screen.getByText(/Your earlier start check-in is complete/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('tab', { name: /Challenge 2/ }),
  ).not.toBeInTheDocument();
});

it('opens the new execution task and downloads its toolkit', async () => {
  invoke.mockImplementation(async (channel: string) => {
    if (channel === 'pre-assessment-state')
      return { complete: false, sets: { A: setA, E: null } };
    if (channel === 'pre-assessment-execution-state')
      return {
        unlocked: true,
        complete: false,
        toolkit_available: true,
        toolkit_filename: 'pre-assessment-toolkit.zip',
        execution_started_at: null,
        sections: { execution: null, ai_literacy: null, self_efficacy: null },
      };
    if (channel === 'pre-assessment-download-toolkit') return { success: true };
    return null;
  });
  panel();
  fireEvent.click(await screen.findByRole('tab', { name: /Execution task/ }));
  expect(
    await screen.findByText('Count Before You Commit'),
  ).toBeInTheDocument();
  expect(screen.getByText(/inventory.xlsx/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Download all toolkit files' }),
  );
  expect(await screen.findByText('Toolkit file saved.')).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith('pre-assessment-download-toolkit');
});
