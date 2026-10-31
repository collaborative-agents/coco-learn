import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ContextViewer from '../renderer/components/chat/ContextViewer';
import ContextViewerAccess from '../renderer/components/chat/ContextViewerAccess';
import ToolViewerAccess from '../renderer/components/chat/ToolViewerAccess';
import TutorModelPicker from '../renderer/components/chat/TutorModelPicker';
import TokenUsageSettings from '../renderer/components/chat/TokenUsageSettings';
import SkillPicker from '../renderer/components/chat/SkillPicker';
import useContextChapterProgress from '../renderer/components/training/useContextChapterProgress';
import useTokenChapter from '../renderer/components/training/useTokenChapter';
import useModelChapter from '../renderer/components/training/useModelChapter';
import useWorkflowChapter from '../renderer/components/training/useWorkflowChapter';

jest.mock('../renderer/components/training/useContextChapterProgress');
jest.mock('../renderer/components/training/useTokenChapter');
jest.mock('../renderer/components/training/useModelChapter');
jest.mock('../renderer/components/training/useWorkflowChapter');

function progress(chapter: number) {
  (useContextChapterProgress as jest.Mock).mockReturnValue({
    completedAt: chapter >= 2 ? 'done' : null,
  });
  (useTokenChapter as jest.Mock).mockReturnValue({
    completedAt: chapter >= 3 ? 'done' : null,
  });
  (useModelChapter as jest.Mock).mockReturnValue({
    completedAt: chapter >= 4 ? 'done' : null,
  });
  (useWorkflowChapter as jest.Mock).mockReturnValue({
    completedAt: chapter >= 5 ? 'done' : null,
  });
}
function Features({ chapter }: { chapter: number }) {
  return (
    <ToolViewerAccess.Provider value={chapter >= 1}>
      <ContextViewerAccess.Provider value={chapter >= 2}>
        <ContextViewer sessionId={null} />
        <TokenUsageSettings />
        <TutorModelPicker
          modelId="test"
          onChange={jest.fn()}
          disabled={false}
        />
        <SkillPicker disabled={false} onSelect={jest.fn()} />
      </ContextViewerAccess.Provider>
    </ToolViewerAccess.Provider>
  );
}

test('reveals only the next locked feature as each chapter is completed', async () => {
  (window as any).electron = {
    ipcRenderer: {
      invoke: jest.fn(async (channel: string) =>
        channel === 'get-model-configuration'
          ? { tutors: [{ id: 'test', label: 'Test model' }] }
          : { requests: [] },
      ),
      on: jest.fn(() => jest.fn()),
    },
  };
  progress(0);
  const { rerender } = render(<Features chapter={0} />);
  expect(
    screen.queryByRole('button', { name: 'Context' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Token usage')).not.toBeInTheDocument();
  expect(screen.queryByText(/Agent 101 Chapter 4/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Skills' }),
  ).not.toBeInTheDocument();
  progress(1);
  rerender(<Features chapter={1} />);
  expect(screen.getByRole('button', { name: 'Context' })).toBeInTheDocument();
  expect(screen.queryByText('Token usage')).not.toBeInTheDocument();
  progress(2);
  rerender(<Features chapter={2} />);
  expect(screen.getByText('Token usage')).toBeInTheDocument();
  expect(screen.queryByText(/Agent 101 Chapter 4/)).not.toBeInTheDocument();
  progress(3);
  rerender(<Features chapter={3} />);
  await screen.findByText('Test model');
  expect(screen.queryByText(/Agent 101 Chapter 4/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Tutor model' }));
  expect(screen.getByText(/Agent 101 Chapter 4/)).toBeInTheDocument();
  expect(window.electron.ipcRenderer.invoke).not.toHaveBeenCalledWith(
    'set-chat-model',
    expect.anything(),
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Tutor model' }), {
    key: 'Escape',
  });
  expect(screen.queryByText(/Agent 101 Chapter 4/)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Skills' }),
  ).not.toBeInTheDocument();
  progress(4);
  rerender(<Features chapter={4} />);
  expect(
    screen.getByRole('combobox', { name: 'Tutor model' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  expect(
    screen.getByRole('link', { name: 'Agent 101 Chapter 5' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('dialog', { name: 'Your skills' }),
  ).not.toBeInTheDocument();
  expect(window.electron.ipcRenderer.invoke).not.toHaveBeenCalledWith(
    'curated-skills-list',
  );
  fireEvent.keyDown(screen.getByRole('button', { name: 'Skills' }), {
    key: 'Escape',
  });
  progress(5);
  rerender(<Features chapter={5} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skills' }));
  expect(
    screen.getByRole('dialog', { name: 'Your skills' }),
  ).toBeInTheDocument();
  await screen.findByRole('button', { name: /Create a skill/ });
  await screen.findByRole('option', { name: 'Test model' });
});
