import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RunnerGameView from '../renderer/components/getting-started/RunnerGameView';
import ObservationBubble from '../renderer/components/ObservationBubble';

const invoke = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  invoke.mockReset().mockImplementation(async (channel: string) => channel === 'runner-preview' ? {
    state: { sessionId: 'game', version: 'v1', tour: 'active', phase: 'play', starterBuild: 'ready', introAcknowledged: true },
    html: '<html><body>Game</body></html>',
  } : {});
  Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke, on: jest.fn(), sendMessage: jest.fn() } } });
});
afterEach(() => jest.useRealTimers());
const suggestions = () => invoke.mock.calls.filter(([channel, payload]) => channel === 'runner-action' && payload.action === 'game-suggestion');

it('waits ten seconds after the game loads, not after the preview request', async () => {
  let resolvePreview!: (value: unknown) => void;
  const preview = new Promise(resolve => { resolvePreview = resolve; });
  invoke.mockImplementationOnce(() => preview);
  await act(async () => { render(<RunnerGameView embedded />); });
  act(() => jest.advanceTimersByTime(30_000));
  expect(suggestions()).toHaveLength(0);
  await act(async () => { resolvePreview({
    state: { sessionId: 'game', version: 'v1', tour: 'active', phase: 'play', starterBuild: 'ready', introAcknowledged: true },
    html: '<html><body>Game</body></html>',
  }); });
  fireEvent.load(screen.getByTitle('Your playable game'));
  act(() => jest.advanceTimersByTime(9999));
  expect(suggestions()).toHaveLength(0);
  act(() => jest.advanceTimersByTime(1));
  expect(suggestions()).toHaveLength(1);
  fireEvent.load(screen.getByTitle('Your playable game'));
  act(() => jest.advanceTimersByTime(20_000));
  expect(suggestions()).toHaveLength(1);
});

it('cancels the pending suggestion when the chat is hidden or unmounted', async () => {
  let view: ReturnType<typeof render>;
  await act(async () => { view = render(<RunnerGameView embedded />); });
  fireEvent.load(screen.getByTitle('Your playable game'));
  act(() => jest.advanceTimersByTime(5000));
  view!.rerender(<RunnerGameView embedded visible={false} />);
  act(() => jest.advanceTimersByTime(20_000));
  expect(suggestions()).toHaveLength(0);
  view!.rerender(<RunnerGameView embedded visible />);
  act(() => jest.advanceTimersByTime(9999));
  expect(suggestions()).toHaveLength(0);
  view!.unmount();
  act(() => jest.advanceTimersByTime(20_000));
  expect(suggestions()).toHaveLength(0);
});

it('uses the existing 4D explanation surface with the normal dismiss button', () => {
  const dismiss = jest.fn();
  const { container } = render(<ObservationBubble bubble={{ status: 'observing', phrase: '', fadingOut: false,
    runnerTutorial: { sessionId: 'game' }, scenario: 'ai_upskilling', suggestion: {
      kind: 'content', title: 'Make the game yours', body: 'Play a round.', copyText: 'Play a round.',
      fourDDimension: 'discernment', noticed: 'Sometimes I’ll offer suggestions as you work, like this one.',
      check: 'Try the game and think about how you’d make it yours.', why: 'Judge what AI makes.',
    },
  }} onDismiss={dismiss} />);
  expect(screen.getByText('Discernment')).toBeInTheDocument();
  expect(container.querySelector('.is-framework-overview .bubble-framework-overview')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show me how →' }));
  expect(screen.getByText('Play a round.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Chat with Coco' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '← Why' }));
  expect(screen.getByText('Discernment')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});
