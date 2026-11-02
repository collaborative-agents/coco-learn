/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import '@testing-library/jest-dom';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuestionConversation from './QuestionConversation';

const questions = [
  { id: 'a', label: '1.', text: 'First question?' },
  { id: 'b', label: '2.', text: 'Second question?' },
  { id: 'c', label: '3.', text: 'Third question?' },
] as const;

const empty = { a: '', b: '', c: '' };

function Harness({
  initial = empty,
  minLength,
  readOnly,
}: {
  initial?: typeof empty;
  minLength?: number;
  readOnly?: boolean;
}) {
  const [answers, setAnswers] = useState(initial);
  return (
    <>
      <QuestionConversation
        idPrefix="test"
        questions={questions}
        answers={answers}
        minLength={minLength}
        readOnly={readOnly}
        onAnswerChange={(id, value) =>
          setAnswers((current) => ({ ...current, [id]: value }))
        }
      />
      <output data-testid="answers">{JSON.stringify(answers)}</output>
    </>
  );
}

const box = () => screen.getByRole('textbox');
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const send = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Send answer' }));
const committed = () =>
  JSON.parse(screen.getByTestId('answers').textContent ?? '{}');

it('asks only the first question at the start', () => {
  render(<Harness />);
  expect(screen.getByText('1. First question?')).toBeInTheDocument();
  expect(screen.queryByText('2. Second question?')).not.toBeInTheDocument();
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect(box()).toHaveAccessibleName('1. First question?');
});

it('reveals the next question after each answer is sent', () => {
  render(<Harness />);
  type('one');
  send();
  expect(screen.getByText('one')).toBeInTheDocument();
  expect(screen.getByText('2. Second question?')).toBeInTheDocument();
  expect(screen.queryByText('3. Third question?')).not.toBeInTheDocument();
  expect(box()).toHaveValue('');
  expect(box()).toHaveFocus();
  type('two');
  send();
  type('three');
  send();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(committed()).toEqual({ a: 'one', b: 'two', c: 'three' });
});

it('sends on Enter but not on Shift+Enter or during IME composition', () => {
  render(<Harness />);
  type('one');
  fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });
  fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
  expect(committed().a).toBe('');
  fireEvent.keyDown(box(), { key: 'Enter' });
  expect(committed().a).toBe('one');
});

it('enforces the minimum answer length', () => {
  render(<Harness minLength={3} />);
  const sendButton = screen.getByRole('button', { name: 'Send answer' });
  expect(sendButton).toBeDisabled();
  type(' ab ');
  expect(sendButton).toBeDisabled();
  fireEvent.keyDown(box(), { key: 'Enter' });
  expect(committed().a).toBe('');
  type('abc');
  expect(sendButton).toBeEnabled();
});

it('reopens an answer for editing and keeps later answers', () => {
  render(<Harness initial={{ a: 'one', b: 'two', c: 'three' }} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit answer: 1. First question?' }),
  );
  expect(box()).toHaveValue('one');
  expect(box()).toHaveFocus();
  expect(committed()).toEqual({ a: '', b: 'two', c: 'three' });
  expect(
    screen.getByRole('button', { name: 'Edit answer: 3. Third question?' }),
  ).toBeDisabled();
  type('changed');
  send();
  expect(committed()).toEqual({ a: 'changed', b: 'two', c: 'three' });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('keeps an unsent draft while an earlier answer is edited', () => {
  render(<Harness initial={{ a: 'one', b: '', c: '' }} />);
  type('unsent');
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit answer: 1. First question?' }),
  );
  expect(box()).toHaveValue('one');
  send();
  expect(box()).toHaveAccessibleName('2. Second question?');
  expect(box()).toHaveValue('unsent');
});

it('shows a transcript with no controls when read-only', () => {
  render(<Harness readOnly initial={{ a: 'one', b: 'two', c: 'three' }} />);
  expect(screen.getByText('3. Third question?')).toBeInTheDocument();
  expect(screen.getByText('three')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
