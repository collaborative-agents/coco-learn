import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ExecutionSection } from '../PostAssessmentPanel';
import type { PostAssessmentState } from '../../../shared/post-assessment';

const invoke = jest.fn();
const state: PostAssessmentState = {
  unlocked: true,
  complete: false,
  toolkit_available: true,
  toolkit_filename: 'toolkit.zip',
  execution_started_at: '2026-11-01T12:00:00Z',
  sections: { self_efficacy: null, ai_literacy: null, execution: null },
};
const recorder = {
  status: 'recording',
  started_at: state.execution_started_at,
  capture_count: 2,
  can_generate_log: true,
  last_error: null,
};

beforeEach(() => {
  invoke.mockReset();
  invoke.mockImplementation(async (channel: string) => {
    if (channel.endsWith('-recorder-state')) return recorder;
    if (channel === 'study-submission-attempts') return { attempts: [] };
    return { status: 'pending' };
  });
  (window as any).electron = { ipcRenderer: { invoke } };
});

it.each(['pre-assessment', 'post-assessment', 'follow-up-assessment'])(
  'submits %s through a separate reflection and celebrates only after success',
  async (route) => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const props = {
      state,
      busy: false,
      preAssessment: route === 'pre-assessment',
      followUp: route === 'follow-up-assessment',
      onStart: jest.fn(),
      onDownload: jest.fn(),
      onChooseAnswerSheet: jest.fn().mockResolvedValue('answer.pdf'),
      onSubmit,
    };
    const view = render(<ExecutionSection {...props} />);
    await screen.findByText('Recording task activity');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Choose answer sheet PDF' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Submit' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Tell us about your approach',
    });
    expect(within(dialog).getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('radio', { name: '8' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }));
    for (let i = 0; i < 5; i += 1) {
      expect(onSubmit).not.toHaveBeenCalled();
      const input = within(dialog).getByRole('textbox');
      expect(input.getAttribute('aria-label')).not.toMatch(/^\d+\./);
      fireEvent.change(input, { target: { value: `Answer ${i + 1}` } });
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Send answer' }),
      );
    }
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      ownership: 8,
      decision: 'Answer 1',
      reasoning: 'Answer 2',
      aiUse: 'Answer 3',
      alternatives: 'Answer 4',
      challenge: 'Answer 5',
    });
    expect(
      within(dialog).queryByRole('button', { name: /Edit answer/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Congratulations!')).not.toBeInTheDocument();
    view.rerender(
      <ExecutionSection {...props} submissionError="Upload failed" />,
    );
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Upload failed',
    );
    expect(within(dialog).getByText('Answer 5')).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Retry submission' }),
    );
    expect(onSubmit).toHaveBeenCalledTimes(2);
    view.rerender(
      <ExecutionSection
        {...props}
        state={{
          ...state,
          sections: {
            ...state.sections,
            execution: {
              completed_at: '2026-11-01T13:00:00Z',
              started_at: state.execution_started_at!,
              duration_seconds: 3600,
              outcome_filename: 'answer.pdf',
              interaction_log_filenames: ['activity.pdf'],
            },
          },
        }}
      />,
    );
    const celebration = screen.getByRole('dialog', {
      name: 'Mission complete',
    });
    expect(
      within(celebration).getByText('Congratulations!'),
    ).toBeInTheDocument();
    fireEvent.click(
      within(celebration).getByRole('button', { name: 'View submission' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Download answer.pdf' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith('study-submission-attempts', route),
    );
  },
);

it('requires a PDF selection and a usable recording before reflection', async () => {
  invoke.mockResolvedValue({ ...recorder, can_generate_log: false });
  const choose = jest
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce('answer.pdf');
  render(
    <ExecutionSection
      state={state}
      busy={false}
      onStart={jest.fn()}
      onDownload={jest.fn()}
      onChooseAnswerSheet={choose}
      onSubmit={jest.fn()}
    />,
  );
  await screen.findByText('Recording task activity');
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose answer sheet PDF' }),
  );
  await waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
  expect(
    screen.queryByRole('button', { name: 'Submit' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Choose answer sheet PDF' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Submit' }),
  ).toBeDisabled();
});
