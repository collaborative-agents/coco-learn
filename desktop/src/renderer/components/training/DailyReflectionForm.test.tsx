import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DailyReflectionForm from './DailyReflectionForm';

const invoke = jest.fn();

const form = ({
  deliverableRequired = true,
  submittedFiles = [] as string[],
} = {}) =>
  render(
    <DailyReflectionForm
      day={1}
      busy={false}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
      deliverableRequired={deliverableRequired}
      submittedFiles={submittedFiles}
    />,
  );

beforeEach(() => {
  invoke.mockReset();
  (window as any).electron = { ipcRenderer: { invoke } };
});

it('requires a deliverable before the reflection can start', async () => {
  invoke.mockResolvedValue({ filenames: ['article.docx', 'summary.docx'] });
  form();
  const next = screen.getByRole('button', { name: 'Next: ratings' });
  expect(next).toBeDisabled();
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  expect(await screen.findByText('article.docx')).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith('study-submit-deliverable', 1);
  expect(next).toBeEnabled();
  fireEvent.click(next);
  expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
});

it('stays blocked when the file picker is cancelled', async () => {
  invoke.mockResolvedValue({ canceled: true });
  form();
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  await waitFor(() => expect(invoke).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeEnabled(),
  );
  expect(screen.getByRole('button', { name: 'Next: ratings' })).toBeDisabled();
});

it('shows why a file was rejected and lets the participant try again', async () => {
  invoke.mockRejectedValueOnce(new Error('scan.pdf: no readable text'));
  invoke.mockResolvedValueOnce({ filenames: ['report.docx'] });
  form();
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'no readable text',
  );
  expect(screen.getByRole('button', { name: 'Next: ratings' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Choose files' }));
  expect(await screen.findByText('report.docx')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('continues from files already uploaded', () => {
  form({ submittedFiles: ['memo.pdf'] });
  expect(screen.getByText('memo.pdf')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Replace files' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Next: ratings' })).toBeEnabled();
});

it('skips the upload for participants who started before the cutover', () => {
  form({ deliverableRequired: false });
  expect(
    screen.queryByRole('button', { name: 'Choose files' }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
});
