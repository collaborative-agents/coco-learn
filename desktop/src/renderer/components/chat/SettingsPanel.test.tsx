import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';

const sections = {
  general: <input aria-label="Name draft" defaultValue="Alex" />,
  memory: <textarea aria-label="Memory draft" defaultValue="Keep it short" />,
  health: <button type="button">Check again</button>,
};

test('switches categories without losing unsaved edits', () => {
  render(<SettingsPanel sections={sections} />);
  expect(screen.getByRole('button', { name: 'General' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Name draft' }), {
    target: { value: 'Lex' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
  expect(screen.queryByRole('textbox', { name: 'Name draft' })).toBeNull();
  fireEvent.change(screen.getByRole('textbox', { name: 'Memory draft' }), {
    target: { value: 'Use bullets' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Health' }));
  expect(screen.getByRole('button', { name: 'Check again' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'General' }));
  expect(screen.getByRole('textbox', { name: 'Name draft' })).toHaveValue(
    'Lex',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
  expect(screen.getByRole('textbox', { name: 'Memory draft' })).toHaveValue(
    'Use bullets',
  );
});

test('only offers Usage when available and falls back if access changes', () => {
  const view = render(<SettingsPanel sections={sections} />);
  expect(screen.queryByRole('button', { name: 'Usage' })).toBeNull();
  view.rerender(
    <SettingsPanel sections={{ ...sections, usage: <p>Token usage</p> }} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Usage' }));
  expect(screen.getByRole('region', { name: 'Usage settings' })).toBeVisible();
  view.rerender(<SettingsPanel sections={sections} />);
  expect(
    screen.getByRole('region', { name: 'General settings' }),
  ).toBeVisible();
});
