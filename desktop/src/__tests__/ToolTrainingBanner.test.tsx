import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ToolTrainingBanner from '../renderer/components/training/ToolTrainingBanner';
import ToolViewerAccess from '../renderer/components/chat/ToolViewerAccess';
import { ToolCallCard } from '../renderer/components/chat/ToolCallCard';
import { emptyToolProgress } from '../shared/tool-exploration';

beforeEach(() => localStorage.clear());

it('adds goals to normal chat and switches to the paired regular conversation', async () => {
  let progress = emptyToolProgress();
  let refresh = () => {};
  const invoke = jest.fn(async (channel: string) => {
    if (channel === 'tool-chapter-session')
      return {
        user: 'learner',
        sessionId: 'with',
        peerSessionId: 'without',
        mode: 'with',
      };
    if (channel === 'tool-chapter-progress') return progress;
    return undefined;
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        invoke,
        on: (_channel: string, callback: () => void) => {
          refresh = callback;
          return jest.fn();
        },
      },
    },
  });
  const { unmount } = render(<ToolTrainingBanner sessionId="with" />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Try without tools' }),
  );
  expect(invoke).toHaveBeenCalledWith('tool-chapter-switch', 'with');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Chapter 1 passed! 🎉')).not.toBeInTheDocument();
  progress = { ...progress, approved: true };
  act(() => refresh());
  await waitFor(() =>
    expect(
      screen.getByRole('listitem', { name: 'Approve a tool call: Complete' }),
    ).toHaveClass('is-complete'),
  );
  expect(
    screen.getByRole('listitem', { name: 'Deny a tool call: Not yet' }),
  ).not.toHaveClass('is-complete');
  progress = {
    externalInformation: true,
    approved: true,
    denied: true,
    completedAt: '2026-10-26T00:00:00Z',
  };
  act(() => refresh());
  const dialog = await screen.findByRole('dialog', {
    name: 'Chapter 1 passed! 🎉',
  });
  expect(dialog.querySelector('details')).not.toHaveAttribute('open');
  fireEvent.click(dialog.querySelector('summary')!);
  expect(dialog.querySelector('details')).toHaveAttribute('open');
  expect(screen.getByText('arguments')).toBeInTheDocument();
  expect(screen.getByText('result')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Close task details' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('complementary')).toBeInTheDocument();
  unmount();
  render(<ToolTrainingBanner sessionId="with" />);
  await screen.findByRole('complementary');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('keeps tool details locked until the chapter unlock is saved', () => {
  const call = {
    id: 'call',
    name: 'bash',
    arguments: { command: 'cat notes.txt' },
    status: 'completed' as const,
    result: { output: 'practice result' },
  };
  const { container, rerender } = render(
    <ToolViewerAccess.Provider value={false}>
      <ToolCallCard call={call} />
    </ToolViewerAccess.Provider>,
  );
  const locked = container.querySelector('details')!;
  fireEvent.click(container.querySelector('summary')!);
  expect(locked).not.toHaveAttribute('open');
  expect(screen.getByRole('status')).toHaveTextContent(
    'Complete Chapter 1 · Tool in Training',
  );
  expect(screen.queryByText(/practice result/)).not.toBeInTheDocument();
  expect(container.querySelector('pre')).toBeNull();
  rerender(
    <ToolViewerAccess.Provider value>
      <ToolCallCard call={call} />
    </ToolViewerAccess.Provider>,
  );
  fireEvent.click(container.querySelector('summary')!);
  expect(container.querySelector('details')).toHaveAttribute('open');
  expect(container.querySelector('pre')).toHaveTextContent('practice result');
  expect(screen.queryByText(/Complete Chapter 1/)).not.toBeInTheDocument();
});
