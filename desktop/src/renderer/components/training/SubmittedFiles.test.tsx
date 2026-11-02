import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SubmittedFiles from './SubmittedFiles';

it('downloads the selected submitted file and reports success', async () => {
  const invoke = jest.fn().mockResolvedValue({ success: true });
  (window as any).electron = { ipcRenderer: { invoke } };
  render(<SubmittedFiles taskId="day-2" files={['report.pdf', 'data.csv']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download data.csv' }));
  expect(invoke).toHaveBeenCalledWith(
    'study-download-submission',
    'day-2',
    'data.csv',
  );
  expect(await screen.findByRole('status')).toHaveTextContent(
    'data.csv saved.',
  );
});

it('shows download failures and allows retrying', async () => {
  const invoke = jest.fn().mockRejectedValue(new Error('File unavailable.'));
  (window as any).electron = { ipcRenderer: { invoke } };
  render(
    <SubmittedFiles taskId="follow-up-assessment" files={['report.pdf']} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'File unavailable.',
  );
  expect(
    screen.getByRole('button', { name: 'Download report.pdf' }),
  ).toBeEnabled();
});
