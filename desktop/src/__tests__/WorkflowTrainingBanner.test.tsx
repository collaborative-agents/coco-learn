import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import WorkflowTrainingBanner from '../renderer/components/training/WorkflowTrainingBanner';
import type { WorkflowSession } from '../shared/workflow-training';

test('checks persisted goals and resets the trial goal when the skill is revised', () => {
  const session: WorkflowSession = {
    user: 'alice',
    sessionId: 'quest',
    brief: '',
    draft: null,
    version: 0,
    trials: [],
    feedback: '',
    savedSkillId: null,
  };
  const view = render(<WorkflowTrainingBanner session={session} />);
  expect(
    screen.getByRole('listitem', { name: 'Create a skill: Not yet' }),
  ).toHaveAttribute('aria-current', 'step');
  const tested = {
    ...session,
    draft: {
      name: 'skill',
      description: 'Task',
      instructions: 'Steps',
      files: [],
    },
    version: 1,
    trials: [{ input: 'Example', output: 'Result', draftVersion: 1 }],
  };
  view.rerender(<WorkflowTrainingBanner session={tested} />);
  expect(
    screen.getByRole('listitem', { name: 'Create a skill: Complete' }),
  ).toHaveClass('is-complete');
  expect(
    screen.getByRole('listitem', { name: 'Test the latest version: Complete' }),
  ).toHaveClass('is-complete');
  expect(
    screen.getByRole('listitem', { name: 'Confirm saving: Not yet' }),
  ).toHaveAttribute('aria-current', 'step');
  view.rerender(<WorkflowTrainingBanner session={{ ...tested, version: 2 }} />);
  expect(
    screen.getByRole('listitem', { name: 'Test the latest version: Not yet' }),
  ).toHaveAttribute('aria-current', 'step');
  view.rerender(
    <WorkflowTrainingBanner session={{ ...tested, savedSkillId: 'saved' }} />,
  );
  expect(screen.getAllByRole('listitem', { name: /: Complete$/ })).toHaveLength(
    4,
  );
});
