/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import { useState } from 'react';
import {
  DAILY_REFLECTION_OPEN_QUESTIONS,
  DAILY_REFLECTION_RATING_QUESTIONS,
  type DailyReflection,
} from '../../../shared/study';
import TrainingDialog from './TrainingDialog';
import LikertQuestions from './LikertQuestions';
import QuestionConversation from './QuestionConversation';
import { SELF_EFFICACY_SCALE } from '../../../shared/post-assessment';
import './DailyReflectionForm.css';

const responseKeys = ['q6', 'q7', 'q8'] as const;

const REFLECTION_CONVERSATION = DAILY_REFLECTION_OPEN_QUESTIONS.map(
  (text, index) => ({
    id: responseKeys[index],
    text,
  }),
);

const emptyReflection = (): DailyReflection => ({
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0,
  q6: '',
  q7: '',
  q8: '',
});

export default function DailyReflectionForm({
  day,
  busy,
  error = '',
  onClose,
  onSubmit,
}: {
  day: number;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (answers: DailyReflection) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<DailyReflection>(emptyReflection);
  const [step, setStep] = useState<'ratings' | 'writing'>('ratings');
  const ratingKeys = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;
  const ratingsReady = ratingKeys.every(
    (key) => answers[key] >= 1 && answers[key] <= 5,
  );
  const ready =
    ratingsReady && responseKeys.every((key) => answers[key].trim().length > 0);

  return (
    <TrainingDialog
      open
      title="Tell us about your practice"
      onClose={onClose}
      busy={busy}
    >
      <section className="training-reflection">
        {error && (
          <p role="alert" className="training-error">
            {error}
          </p>
        )}
        {step === 'ratings' && (
          <>
            <LikertQuestions
              questions={DAILY_REFLECTION_RATING_QUESTIONS.map(
                (text, index) => ({ id: ratingKeys[index], text }),
              )}
              options={SELF_EFFICACY_SCALE}
              answers={Object.fromEntries(
                ratingKeys.map((key) => [key, answers[key]]),
              )}
              disabled={busy}
              onChange={(id, value) =>
                setAnswers((current) => ({ ...current, [id]: value }))
              }
            />
            <button
              type="button"
              className="training-primary"
              disabled={busy || !ratingsReady}
              onClick={() => setStep('writing')}
            >
              Next
            </button>
          </>
        )}
        {step === 'writing' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setStep('ratings')}
          >
            Back to ratings
          </button>
        )}
        {/* Stays mounted during the ratings step so unsent text is kept. */}
        <div hidden={step !== 'writing'}>
          <QuestionConversation
            idPrefix={`day-${day}`}
            questions={REFLECTION_CONVERSATION}
            answers={answers}
            maxLength={5000}
            disabled={busy}
            allowEditing={false}
            onAnswerChange={(id, value) => {
              const next = { ...answers, [id]: value };
              setAnswers(next);
              if (
                ratingsReady &&
                responseKeys.every((key) => next[key].trim())
              ) {
                onSubmit(next);
              }
            }}
          />
        </div>
        {step === 'writing' && ready && (
          <div className="training-reflection-submit">
            {busy ? (
              <p role="status">Saving your reflection…</p>
            ) : (
              <button
                type="button"
                className="training-proof-action"
                onClick={() => onSubmit(answers)}
              >
                Retry submission
              </button>
            )}
          </div>
        )}
      </section>
    </TrainingDialog>
  );
}
