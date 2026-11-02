import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DailyReflectionForm from './DailyReflectionForm';

it('starts with reflection ratings after the task is marked finished', () => {
  render(
    <DailyReflectionForm
      day={1}
      busy={false}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
    />,
  );
  expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
  expect(
    screen.getByRole('button', { name: 'Next' }),
  ).toBeDisabled();
  expect(
    screen.queryByRole('button', { name: 'Choose files' }),
  ).not.toBeInTheDocument();
});
