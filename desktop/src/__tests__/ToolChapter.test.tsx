import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ToolChapter from '../renderer/components/training/ToolChapter';

it('explains each part of the tool loop through diagram nodes and steps', () => {
  render(<ToolChapter />);
  expect(screen.getByText('Start with a question')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Coco chooses the action' }),
  );
  expect(screen.getByText('Coco requests an action')).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Bash tool runs commands' }),
  );
  expect(screen.getByText('The tool returns a result')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '3. Bash tool' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  fireEvent.click(screen.getByRole('button', { name: '4. Answer' }));
  expect(screen.getByText('Coco uses the result')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'You' }));
  expect(screen.getByText('Start with a question')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
