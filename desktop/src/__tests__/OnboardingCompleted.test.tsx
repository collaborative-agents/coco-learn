import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OnboardingCompleted from '../renderer/components/getting-started/OnboardingCompleted';

it('celebrates in the app and opens Agent 101 only when requested', async () => {
  const invoke = jest.fn(async () => ({}));
  Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke } } });
  const close = jest.fn();
  render(<OnboardingCompleted sessionId="game" onClose={close} />);
  expect(screen.getByRole('dialog', { name: 'Your first project with Coco' })).toBeInTheDocument();
  expect(screen.getByText('Congratulations!')).toBeInTheDocument();
  expect(invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Explore Agent 101' }));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(invoke).toHaveBeenCalledWith('runner-action', { sessionId: 'game', action: 'open-training' });
});

it('can be dismissed without leaving chat', () => {
  const close = jest.fn();
  render(<OnboardingCompleted sessionId="game" onClose={close} />);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(1);
});
