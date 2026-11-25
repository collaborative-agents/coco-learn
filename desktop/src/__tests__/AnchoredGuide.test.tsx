import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AnchoredGuide from '../renderer/components/getting-started/AnchoredGuide';
import { learningIntroduction } from '../shared/learning-introduction';

afterEach(() => jest.restoreAllMocks());

it('keeps the tip beside its target, follows movement, and flips at the window edge', () => {
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: 330, height: 220 } as DOMRect);
  const guide = learningIntroduction('coco-setup', 'training');
  const { rerender } = render(
    <AnchoredGuide
      guide={guide}
      bounds={{ left: 10, top: 200, width: 44, height: 44 }}
    />,
  );
  const tip = screen.getByRole('region', { name: 'TRAINING TASKS' });
  expect(tip).toHaveClass('points-left');
  expect(tip).toHaveStyle({ left: '78px', top: '112px' });
  rerender(
    <AnchoredGuide
      guide={guide}
      bounds={{ left: 900, top: 300, width: 44, height: 44 }}
    />,
  );
  expect(tip).toHaveClass('points-right');
  expect(tip).toHaveStyle({ left: '546px', top: '212px' });
});

it('places the tip below the target in a narrow window and keeps its pointer aligned', () => {
  jest.replaceProperty(window, 'innerWidth', 400);
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width: 330, height: 220 } as DOMRect);
  render(
    <AnchoredGuide
      guide={learningIntroduction('coco-setup', 'tool')}
      bounds={{ left: 180, top: 100, width: 44, height: 44 }}
    />,
  );
  const tip = screen.getByRole('region');
  expect(tip).toHaveClass('points-top');
  expect(tip).toHaveStyle({
    left: '37px',
    top: '168px',
    '--guide-arrow': '165px',
  });
});

it('advances and dismisses using the real onboarding actions and allows retry after a failure', async () => {
  const invoke = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue({});
  (window as any).electron = { ipcRenderer: { invoke } };
  render(
    <AnchoredGuide
      guide={learningIntroduction('coco-setup', 'training')}
      bounds={{ left: 10, top: 200, width: 44, height: 44 }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Please try again',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Got it' })).toBeEnabled(),
  );
  expect(invoke).toHaveBeenCalledWith('runner-action', {
    sessionId: 'coco-setup',
    action: 'show-around',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close tip' }));
  expect(invoke).toHaveBeenLastCalledWith('runner-action', {
    sessionId: 'coco-setup',
    action: 'dismiss',
  });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Close tip' })).toBeEnabled(),
  );
});
