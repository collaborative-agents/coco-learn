/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SET_A_QUESTIONS,
  type PreAssessmentResult,
  type PreAssessmentSet,
  type PreAssessmentState,
  type SetAAnswers,
  type SetEAnswers,
} from '../../shared/pre-assessment';
import PreExecutionPanel from './PreExecutionPanel';
import AssessmentCompleted from './training/AssessmentCompleted';

const invoke = (
  channel: Parameters<typeof window.electron.ipcRenderer.invoke>[0],
  ...args: unknown[]
) => window.electron.ipcRenderer.invoke(channel, ...args);

function ScoreCard({ result }: { result: PreAssessmentResult }) {
  if (result.score === null)
    return (
      <div className="pre-assessment-score pre-assessment-score--growing">
        <span className="pre-assessment-score-icon" aria-hidden>
          ✦
        </span>
        <div>
          <h3>Grading your answers…</h3>
          <p>Your score will appear here when grading finishes.</p>
        </div>
      </div>
    );
  const strong = result.score / result.maxScore >= 0.75;
  return (
    <div
      className={`pre-assessment-score pre-assessment-score--${strong ? 'strong' : 'growing'}`}
    >
      <span className="pre-assessment-score-icon" aria-hidden>
        {strong ? '★' : '✦'}
      </span>
      <div>
        <h3>
          {result.score} / {result.maxScore}
        </h3>
        <p>
          {strong
            ? 'Excellent work! You already have a strong foundation for working thoughtfully with AI.'
            : 'Nice start! The camp will help you build on this foundation—every challenge is a chance to grow.'}
        </p>
      </div>
    </div>
  );
}

function SetAChallenge({
  result,
  onSubmit,
  busy,
}: {
  result: PreAssessmentResult | null;
  onSubmit: (set: PreAssessmentSet, answers: SetAAnswers) => Promise<void>;
  busy: boolean;
}) {
  const [answers, setAnswers] = useState<SetAAnswers>(() =>
    result ? (result.answers as SetAAnswers) : {},
  );
  const complete = Boolean(result);
  const allAnswered = SET_A_QUESTIONS.every(
    (question) => answers[String(question.id)],
  );

  return (
    <section
      className={`post-assessment-section pre-assessment-challenge${complete ? ' pre-assessment-challenge--complete' : ''}`}
    >
      <div className="pre-assessment-challenge-header">
        <div>
          <h3>AI literacy</h3>
          <p>Choose the one best answer for each question.</p>
        </div>
        {complete && (
          <span className="pre-assessment-status pre-assessment-status--done">
            ✓ Complete
          </span>
        )}
      </div>

      {complete && result && <ScoreCard result={result} />}

      <div className="pre-assessment-questions">
        {SET_A_QUESTIONS.map((question) => {
          const submittedAnswer = result
            ? (result.answers as SetAAnswers)[String(question.id)]
            : null;
          return (
            <fieldset key={question.id} className="pre-assessment-question">
              <legend>
                <span>{question.id}</span>
                {question.question}
              </legend>
              <div className="pre-assessment-options">
                {question.options.map((option) => {
                  const selected =
                    (result
                      ? (result.answers as SetAAnswers)[String(question.id)]
                      : answers[String(question.id)]) === option.id;
                  const correct =
                    complete && option.id === question.correctAnswer;
                  const incorrect = complete && selected && !correct;
                  return (
                    <label
                      key={option.id}
                      htmlFor={`set-a-${question.id}-${option.id}`}
                      className={`${correct ? 'pre-assessment-option--correct' : ''}${incorrect ? ' pre-assessment-option--incorrect' : ''}`}
                    >
                      <input
                        id={`set-a-${question.id}-${option.id}`}
                        type="radio"
                        name={`set-a-${question.id}`}
                        value={option.id}
                        checked={selected}
                        disabled={complete || busy}
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [String(question.id)]: option.id,
                          }))
                        }
                      />
                      <strong>{option.id}</strong>
                      <span>{option.text}</span>
                    </label>
                  );
                })}
              </div>
              {complete && (
                <p className="pre-assessment-answer-note">
                  <strong>Answer: {question.correctAnswer}.</strong>{' '}
                  {question.rationale}
                  {submittedAnswer !== question.correctAnswer && (
                    <span> Your answer was {submittedAnswer}.</span>
                  )}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>

      {!complete && (
        <button
          type="button"
          className="pre-assessment-submit"
          disabled={busy || !allAnswered}
          onClick={() => onSubmit('A', answers)}
        >
          {busy ? 'Checking answers…' : 'Finish AI literacy & see my score'}
        </button>
      )}
    </section>
  );
}

export default function PreAssessmentPanel({
  onCompletionChange,
  required = true,
}: {
  onCompletionChange: (complete: boolean) => void;
  required?: boolean;
}) {
  const [state, setState] = useState<PreAssessmentState | null>(null);
  const [activeSet, setActiveSet] = useState<'A' | 'execution'>('A');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const next = (await invoke('pre-assessment-state')) as PreAssessmentState;
    setState(next);
    onCompletionChange(next.complete);
  }, [onCompletionChange]);

  useEffect(() => {
    load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [load]);

  const completedCount = useMemo(
    () =>
      state
        ? Number(Boolean(state.sets.A)) +
          Number(Boolean(state.execution || state.complete))
        : 0,
    [state],
  );

  const submit = async (
    set: PreAssessmentSet,
    answers: SetAAnswers | SetEAnswers,
  ) => {
    setBusy(true);
    setError('');
    try {
      await invoke('pre-assessment-submit', set, answers);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const challengeContent = state ? (
    <>
      <div
        className="pre-assessment-tabs post-assessment-tabs"
        role="tablist"
        aria-label="Pre-assessment challenges"
      >
        {(['A', 'execution'] as const).map((set, index) => (
          <button
            key={set}
            type="button"
            role="tab"
            aria-selected={activeSet === set}
            onClick={() => setActiveSet(set)}
          >
            <span>
              {(set === 'A' ? state.sets.A : state.execution || state.complete)
                ? '✓'
                : index + 1}
            </span>
            {set === 'A' ? 'AI literacy' : 'Execution task'}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {activeSet === 'A' ? (
          <SetAChallenge result={state.sets.A} onSubmit={submit} busy={busy} />
        ) : (
          <PreExecutionPanel
            onSubmitted={load}
            legacyComplete={Boolean(state.complete && !state.execution)}
          />
        )}
      </div>
    </>
  ) : (
    <p>Loading your pre-assessments…</p>
  );

  return (
    <section
      className={`training-card pre-assessment post-assessment${state?.complete ? ' pre-assessment--complete post-assessment--complete' : ''}`}
      aria-label="Starting assessment"
    >
      {state?.complete && <AssessmentCompleted />}
      {!state?.complete && (
        <div className="post-assessment-intro">
          <div>
            <h2 id="pre-assessment-title">Complete your start check-in</h2>
            <p>
              {required
                ? 'These questions help you see your starting point. Coco chat, sensing, and camp tasks unlock after AI literacy and the execution task are complete.'
                : 'This is the participant pre-assessment experience. Admin accounts can preview and complete AI literacy and the execution task.'}
            </p>
          </div>
          <div
            className="pre-assessment-progress"
            role="progressbar"
            aria-label="Pre-assessment progress"
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuenow={completedCount}
          >
            <strong>{completedCount}/2</strong>
            <span>submitted</span>
          </div>
        </div>
      )}
      {error && (
        <p className="training-error" role="alert">
          {error}
        </p>
      )}
      {challengeContent}
    </section>
  );
}
