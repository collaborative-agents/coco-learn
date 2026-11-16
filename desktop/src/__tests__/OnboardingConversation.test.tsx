import { act, renderHook } from '@testing-library/react';
import useOnboardingConversation from '../renderer/components/getting-started/useOnboardingConversation';
import type { RunnerTutorialState } from '../shared/runner-tutorial';

const game: RunnerTutorialState = {
  sessionId: 'game', version: 'v1', phase: 'play', tour: 'active',
  starterBuild: 'ready', hasChanges: false, canUndo: false, error: null,
};

it.each(['Explore on my own', 'I want to explore Coco on my own.', 'Let me explore by myself'])('ends onboarding for “%s” after the game', async text => {
  const invoke = jest.fn(async () => ({}));
  (window as any).electron = { ipcRenderer: { invoke } };
  const setMessages = jest.fn();
  const { result } = renderHook(() => useOnboardingConversation({ state: game, sessionId: 'game', messages: [], setMessages }));
  await act(async () => expect(await result.current.respond(text)).toBe(true));
  expect(invoke).toHaveBeenCalledWith('runner-action', { sessionId: 'game', action: 'finish-setup' });
  expect(invoke).toHaveBeenCalledTimes(1);
});

it('stops adding tutorial messages and intercepting chat after completion', async () => {
  const invoke = jest.fn();
  (window as any).electron = { ipcRenderer: { invoke } };
  const setMessages = jest.fn();
  const { result, rerender } = renderHook(({ state }) => useOnboardingConversation({ state, sessionId: 'game', messages: [], setMessages }), { initialProps: { state: game } });
  setMessages.mockClear();
  rerender({ state: { ...game, tour: 'finished', phase: 'review', hasChanges: true } });
  expect(result.current.active).toBe(false);
  expect(setMessages).not.toHaveBeenCalled();
  await act(async () => expect(await result.current.respond('looks good')).toBe(false));
  expect(invoke).not.toHaveBeenCalled();
});

it('does not finish onboarding before the game exists', async () => {
  const invoke = jest.fn();
  (window as any).electron = { ipcRenderer: { invoke } };
  const { result } = renderHook(() => useOnboardingConversation({ state: { ...game, tour: 'meet', starterBuild: 'waiting' }, sessionId: 'game', messages: [], setMessages: jest.fn() }));
  await act(async () => expect(await result.current.respond('Explore on my own')).toBe(false));
  expect(invoke).not.toHaveBeenCalled();
});
