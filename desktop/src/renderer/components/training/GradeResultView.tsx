import { useEffect, useState } from 'react';
import type { Grade } from '../../../shared/grading';
import { api } from './training-api';
import './GradeResultView.css';

const POLL_MS = 15_000;

function ReportProblem({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  if (sent)
    return <p role="status">Thanks. The study team will review your report.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Report a problem
      </button>
    );
  return (
    <div className="grade-report">
      <label htmlFor={`grade-report-${taskId}`}>
        What looks wrong with this result?
        <textarea
          id={`grade-report-${taskId}`}
          value={message}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="training-error">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!message.trim()}
        onClick={async () => {
          setError('');
          try {
            await api('study-grade-report', taskId, message);
            setSent(true);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
          }
        }}
      >
        Send report
      </button>
    </div>
  );
}

export default function GradeResultView({ taskId }: { taskId: string }) {
  const [grade, setGrade] = useState<Grade | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      let next: Grade | null = null;
      try {
        next = (await api('study-grade', taskId)) as Grade | null;
      } catch {
        // Results are additional to the submission, so a failed check stays
        // quiet and is tried again.
      }
      if (!active) return;
      if (next) setGrade(next);
      if (!next || next.status === 'pending')
        timer = window.setTimeout(load, POLL_MS);
    };
    load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [taskId]);

  if (!grade || grade.status === 'none') return null;
  if (grade.status === 'pending')
    return (
      <section className="grade-result" aria-label="Your results">
        <p role="status">
          <strong>Grading…</strong> Your score and feedback will appear here.
        </p>
      </section>
    );
  return (
    <section className="grade-result" aria-label="Your results">
      <div className="grade-result-header">
        <h3>
          Your result: {grade.score} / {grade.max_score}
        </h3>
        {grade.band && (
          <span
            className={`grade-band grade-band--${grade.band.toLowerCase()}`}
          >
            {grade.band}
          </span>
        )}
      </div>
      {grade.corrected && grade.correction_note && (
        <p role="status">
          <strong>Updated by the study team:</strong> {grade.correction_note}
        </p>
      )}
      {grade.feedback && <p>{grade.feedback}</p>}
      {Boolean(grade.sections?.length) && (
        <dl className="grade-sections">
          {grade.sections!.map((section) => (
            <div key={section.label}>
              <dt>{section.label}</dt>
              <dd>
                {section.score} / {section.max_score}
              </dd>
            </div>
          ))}
          {Boolean(grade.bonus) && (
            <div>
              <dt>Bonus, reported separately</dt>
              <dd>+{grade.bonus}</dd>
            </div>
          )}
        </dl>
      )}
      {Boolean(grade.strengths?.length) && (
        <>
          <h4>What went well</h4>
          <ul>
            {grade.strengths!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      {Boolean(grade.gaps?.length) && (
        <>
          <h4>What to improve</h4>
          <ul>
            {grade.gaps!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
      <p className="grade-disclaimer">
        This feedback is automated and may contain errors.
      </p>
      <ReportProblem taskId={taskId} />
    </section>
  );
}
