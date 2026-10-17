import { useState } from 'react';
import type { TutorToolCall } from '../observation-types';
import { TutorMessage } from './MessageContent';
import './QuestionCard.css';

export default function QuestionCard({
  call,
  interactive,
}: {
  call: TutorToolCall;
  interactive: boolean;
}) {
  const questions = call.result?.questions ?? [];
  const [drafts, setDrafts] = useState<
    Record<number, { selected: string[]; text: string }>
  >({});
  const answers = questions.map(
    (_, index) => drafts[index] ?? { selected: [], text: '' },
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const waiting =
    interactive &&
    call.status === 'running' &&
    call.result?.waitingForAnswer === true &&
    !submitted;
  const update = (index: number, value: { selected: string[]; text: string }) =>
    setDrafts((previous) => ({ ...previous, [index]: value }));
  const ready =
    answers.length === questions.length &&
    answers.every((answer) => answer.selected.length || answer.text.trim());
  const submit = async (cancelled = false) => {
    setSubmitting(true);
    setError('');
    try {
      await window.electron.ipcRenderer.invoke(
        'answer-agent-question',
        call.id,
        { answers, cancelled },
      );
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not send your answer. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };
  let heading = 'Your answers';
  if (call.status === 'error') heading = 'Questions closed';
  if (call.result?.cancelled) heading = 'Questions skipped';
  if (call.status === 'running')
    heading = submitted ? 'Answers sent' : 'Preparing questions…';
  if (waiting) heading = 'Your input needed';
  return (
    <section className="agent-question-card" aria-label="Questions from Coco">
      <div className="agent-question-heading">
        <strong>{heading}</strong>
        <span>{questions.length} questions</span>
      </div>
      {questions.map((question, index) => {
        const answer = answers[index] ?? { selected: [], text: '' };
        const saved = call.result?.answers?.find(
          (item) => item.questionIndex === index,
        );
        let answerText =
          call.status === 'running' ? 'Waiting…' : 'No answer submitted.';
        if (submitted)
          answerText = [...answer.selected, answer.text]
            .filter(Boolean)
            .join(', ');
        if (saved)
          answerText = [...(saved.selected ?? []), saved.answer]
            .filter(Boolean)
            .join(', ');
        const toggle = (label: string) => {
          let selected = [label];
          if (question.multiSelect)
            selected = answer.selected.includes(label)
              ? answer.selected.filter((value) => value !== label)
              : [...answer.selected, label];
          update(index, {
            selected,
            text: question.multiSelect ? answer.text : '',
          });
        };
        return (
          <fieldset key={question.question} disabled={!waiting || submitting}>
            <legend>
              <span className="agent-question-chip">{question.header}</span>
              {question.question}
            </legend>
            {waiting ? (
              <>
                <p className="agent-question-hint">
                  {question.multiSelect
                    ? 'Choose one or more, or add your own answer.'
                    : 'Choose one or write your own answer.'}
                </p>
                <div className="agent-question-options">
                  {question.options.map((option) => (
                    <label
                      key={option.label}
                      htmlFor={`${call.id}-${index}-${option.label}`}
                      className={
                        answer.selected.includes(option.label)
                          ? 'is-selected'
                          : ''
                      }
                    >
                      <input
                        id={`${call.id}-${index}-${option.label}`}
                        type={question.multiSelect ? 'checkbox' : 'radio'}
                        name={`${call.id}-${index}`}
                        checked={answer.selected.includes(option.label)}
                        onChange={() => toggle(option.label)}
                      />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
                {question.options
                  .filter((option) => option.preview)
                  .map((option) => (
                    <details
                      className="agent-question-preview"
                      key={option.label}
                    >
                      <summary>Preview: {option.label}</summary>
                      <TutorMessage text={option.preview!} />
                    </details>
                  ))}
                <textarea
                  aria-label={`Your own answer: ${question.question}`}
                  placeholder="Or write your own answer…"
                  rows={2}
                  maxLength={20000}
                  value={answer.text}
                  onChange={(event) =>
                    update(index, {
                      selected: question.multiSelect ? answer.selected : [],
                      text: event.target.value,
                    })
                  }
                />
              </>
            ) : (
              <p className="agent-question-answer">{answerText}</p>
            )}
          </fieldset>
        );
      })}
      {error && (
        <p role="alert" className="agent-question-error">
          {error}
        </p>
      )}
      {waiting && (
        <div className="agent-question-actions">
          <span>Coco will continue after you respond.</span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              submit(true);
            }}
          >
            Skip
          </button>
          <button
            type="button"
            className="agent-question-submit"
            disabled={!ready || submitting}
            onClick={() => {
              submit();
            }}
          >
            Submit answers
          </button>
        </div>
      )}
      {call.result?.error && (
        <p className="agent-question-error">{call.result.error}</p>
      )}
    </section>
  );
}
