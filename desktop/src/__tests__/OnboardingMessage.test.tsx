import '@testing-library/jest-dom';
import { act, render, screen } from '@testing-library/react';
import OnboardingMessage, { OnboardingTurn, animateOnboardingMessage, preserveOnboardingAnimation } from '../renderer/components/getting-started/OnboardingMessage';
import type { ChatMessage } from '../renderer/components/chat/types';

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
});
afterEach(() => { jest.useRealTimers(); });
const greeting = (): ChatMessage => ({ role: 'tutor', id: 'onboarding-hello', text: 'Hello, let’s build a game together.' });

it('reveals new text progressively without changing the saved message', () => {
  const message = animateOnboardingMessage(greeting());
  const progress = jest.fn();
  const { container } = render(<OnboardingMessage message={message} onProgress={progress} />);
  expect(container.textContent).toBe('Thinking…');
  act(() => jest.advanceTimersByTime(1200));
  expect(container.textContent).toContain('Hello,');
  expect(container.textContent).not.toContain(message.text);
  act(() => jest.advanceTimersByTime(2000));
  expect(container.textContent).toBe(message.text);
  expect(message.text).toBe(greeting().text);
  expect(progress).toHaveBeenCalled();
});
it('shows restored history immediately and respects reduced motion', () => {
  const message = greeting();
  const { rerender, container } = render(<OnboardingMessage message={message} onProgress={() => {}} />);
  expect(container.textContent).toBe(message.text);
  (window.matchMedia as jest.Mock).mockReturnValue({matches:true});
  rerender(<OnboardingMessage key="reduced" message={animateOnboardingMessage(greeting())} onProgress={() => {}} />);
  expect(screen.getByText(message.text)).toBeVisible();
});
it('does not restart typing when build tool activity updates', () => {
  const message = animateOnboardingMessage(greeting());
  const { rerender, container } = render(<OnboardingMessage message={message} onProgress={() => {}} />);
  act(() => jest.advanceTimersByTime(1200));
  const partial = container.textContent;
  const updated = preserveOnboardingAnimation(message, {...message, activity:[]});
  rerender(<OnboardingMessage message={updated} onProgress={() => {}} />);
  expect(container.textContent).toBe(partial);
  act(() => jest.advanceTimersByTime(2000));
  expect(container.textContent).toBe(message.text);
});

it('pauses between onboarding messages instead of typing them at once', () => {
  const first = animateOnboardingMessage(greeting());
  const second = animateOnboardingMessage({...greeting(), id: 'onboarding-workspace'}, first);
  const { container } = render(<OnboardingMessage message={second} onProgress={() => {}} />);
  act(() => jest.advanceTimersByTime(2200));
  expect(container.textContent).toBe('Thinking…');
  act(() => jest.advanceTimersByTime(1000));
  expect(container.textContent).toContain('Hello,');
  act(() => jest.advanceTimersByTime(2000));
  expect(container.textContent).toBe(second.text);
});

it('keeps the game and tool activity hidden until the message finishes typing', () => {
  const message = animateOnboardingMessage(greeting());
  render(<OnboardingMessage message={message} onProgress={() => {}}>
    <div>Game preview</div><div>Build activity</div>
  </OnboardingMessage>);
  expect(screen.queryByText('Game preview')).toBeNull();
  act(() => jest.advanceTimersByTime(1200));
  expect(screen.queryByText('Game preview')).toBeNull();
  expect(screen.queryByText('Build activity')).toBeNull();
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.getByText('Game preview')).toBeVisible();
  expect(screen.getByText('Build activity')).toBeVisible();
});

it('shows one thinking turn at a time when build messages are queued together', () => {
  const first = animateOnboardingMessage(greeting());
  const second = animateOnboardingMessage({ role: 'tutor', text: 'Building your game.' }, first);
  const turn = (message: ChatMessage) => <OnboardingTurn message={message}><OnboardingMessage message={message} onProgress={() => {}} /></OnboardingTurn>;
  render(<>{turn(first)}{turn(second)}</>);
  expect(screen.getAllByText('Thinking…')).toHaveLength(1);
  act(() => jest.advanceTimersByTime(1024 + Array.from(first.text).length * 24));
  expect(screen.getAllByText('Thinking…')).toHaveLength(1);
  expect(screen.getByText(first.text)).toBeInTheDocument();
  act(() => jest.advanceTimersByTime(2000));
  expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
  expect(screen.getByText(second.text)).toBeInTheDocument();
});
