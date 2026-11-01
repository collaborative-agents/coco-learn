import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkflowUnlock from '../renderer/components/training/WorkflowUnlock';
import CuratedSkills from '../renderer/components/training/CuratedSkills';
import type { WorkflowSession } from '../shared/workflow-training';

jest.mock('../renderer/components/chat/MessageContent', () => ({
  TutorMessage: ({ text }: { text: string }) => <p>{text}</p>,
}));
const draft = {
  name: 'weekly-update',
  description: 'Prepare a weekly team update.',
  instructions: '## Workflow\nAsk about the audience, then draft an update.',
  files: [{ name: 'template.md', content: '# Team update' }],
};
const session: WorkflowSession = {
  user: 'alice',
  sessionId: 'quest',
  brief: 'Weekly team update',
  draft,
  version: 1,
  trials: [],
  feedback: '',
  savedSkillId: null,
};
const invoke = jest.fn();
beforeEach(() => {
  invoke.mockReset().mockResolvedValue({});
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { invoke, on: jest.fn(() => jest.fn()) } },
  });
});
test('completion shows the created skill and explains the input bar star without a browse button', () => {
  localStorage.clear();
  render(<WorkflowUnlock session={{ ...session, savedSkillId: 'saved' }} />);
  expect(
    screen.getByRole('dialog', { name: 'Chapter 5 passed! 🎉' }),
  ).toBeInTheDocument();
  expect(screen.getByText('weekly-update')).toBeInTheDocument();
  expect(screen.getByText(draft.description)).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: /star Skills button highlighted/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Browse my skills' }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('View your skill'));
  expect(screen.getByText(/Ask about the audience, then draft an update/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close task details' }));
  expect(localStorage.getItem('workflow-skill-guide:alice:saved')).toBe('seen');
});
test('library exposes skill content and supporting files, selects a skill, and opens the folder', async () => {
  const onSelect = jest.fn();
  invoke.mockResolvedValue([
    {
      ...draft,
      id: 'saved',
      savedAt: 'today',
      markdown: '---\nname: weekly-update\n---\nInstructions',
    },
  ]);
  render(<CuratedSkills onSelect={onSelect} />);
  fireEvent.click(await screen.findByText('weekly-update'));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'weekly-update' }),
  );
  fireEvent.click(screen.getByText('View instructions'));
  expect(screen.getByText('template.md')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open skill folder' }));
  expect(invoke).toHaveBeenCalledWith('curated-skills-reveal', 'saved');
});
