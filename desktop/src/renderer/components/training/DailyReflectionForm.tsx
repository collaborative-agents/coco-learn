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
import { api } from './training-api';
import './DailyReflectionForm.css';

const responseKeys = ['q6', 'q7', 'q8'] as const;

const REFLECTION_CONVERSATION = DAILY_REFLECTION_OPEN_QUESTIONS.map(
  (text, index) => ({
    id: responseKeys[index],
    label: `${index + 6}.`,
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
  deliverableRequired = false,
  submittedFiles = [],
  busy,
  error = '',
  onClose,
  onSubmit,
}: {
  day: number;
  deliverableRequired?: boolean;
  submittedFiles?: string[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (answers: DailyReflection) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<DailyReflection>(emptyReflection);
  const [files, setFiles] = useState<string[]>(submittedFiles);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [step, setStep] = useState<'deliverable' | 'ratings' | 'writing'>(
    deliverableRequired ? 'deliverable' : 'ratings',
  );
  const chooseFiles = async () => {
    setUploading(true);
    setUploadError('');
    try {
      const result = (await api('study-submit-deliverable', day)) as {
        canceled?: boolean;
        filenames?: string[];
      };
      if (!result.canceled) setFiles(result.filenames ?? []);
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setUploading(false);
    }
  };
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
        <div className="training-reflection-header">
          <div>
            <span className="training-eyebrow">DAY {day} REFLECTION</span>
            <p>
              There are no right or wrong answers. Your honest feedback helps us
              improve the camp.
            </p>
          </div>
        </div>

        {step === 'deliverable' && (
          <div className="training-deliverable">
            <h4>Submit your finished work</h4>
            <p>
              Upload everything the task asks you to submit, as PDF, Word,
              Excel, CSV, or text files. You’ll get a score and feedback after
              you finish this reflection, and you can replace your files until
              then.
            </p>
            {uploadError && (
              <p role="alert" className="training-error">
                {uploadError}
              </p>
            )}
            {files.length > 0 && (
              <ul aria-label="Files submitted">
                {files.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
            <button type="button" disabled={uploading} onClick={chooseFiles}>
              {uploading && 'Checking your files…'}
              {!uploading && (files.length ? 'Replace files' : 'Choose files')}
            </button>
            <button
              type="button"
              className="training-primary"
              disabled={uploading || !files.length}
              onClick={() => setStep('ratings')}
            >
              Next: ratings
            </button>
          </div>
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
              Next: written reflection
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
            onAnswerChange={(id, value) =>
              setAnswers((current) => ({ ...current, [id]: value }))
            }
          />
        </div>
        {step === 'writing' && (
          <div className="training-reflection-submit">
            <div>
              <strong>One last step</strong>
              <span>
                After submitting your reflection, choose a screenshot of your
                favorite moment.
              </span>
            </div>
            <button
              type="button"
              className="training-proof-action"
              disabled={busy || !ready}
              onClick={() => onSubmit(answers)}
            >
              Submit reflection &amp; add screenshot
            </button>
          </div>
        )}
      </section>
    </TrainingDialog>
  );
}
