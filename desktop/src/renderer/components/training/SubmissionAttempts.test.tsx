import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SubmissionAttempts from './SubmissionAttempts';

it('switches feedback and downloads to the selected attempt, including repeated filenames', async () => {
  const newer = 'b'.repeat(32);
  const older = 'a'.repeat(32);
  const invoke = jest.fn(async (channel, ...args) => {
    if (channel === 'study-submission-attempts')
      return {
        attempts: [
          {
            id: newer,
            submitted_at: '2026-11-01T20:00:00Z',
            files: ['report.pdf'],
          },
          {
            id: older,
            submitted_at: '2026-11-01T19:00:00Z',
            files: ['report.pdf'],
          },
        ],
      };
    if (channel === 'study-grade')
      return {
        status: 'graded',
        score: args[1] === older ? 50 : 80,
        max_score: 100,
      };
    return { success: true };
  });
  (window as any).electron = { ipcRenderer: { invoke } };
  render(<SubmissionAttempts taskId="day-2" files={['report.pdf']} />);
  const picker = await screen.findByRole('combobox', {
    name: 'Submission attempt',
  });
  expect(picker).toHaveValue(newer);
  fireEvent.change(picker, { target: { value: older } });
  expect(await screen.findByText('Your result: 50 / 100')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
  expect(invoke).toHaveBeenCalledWith(
    'study-download-submission',
    'day-2',
    'report.pdf',
    older,
  );
});
