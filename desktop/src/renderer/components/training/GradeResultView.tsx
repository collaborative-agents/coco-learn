/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import { useEffect, useState } from 'react';
import type { Grade } from '../../../shared/grading';
import { api } from './training-api';
import './GradeResultView.css';
import GradeFeedback from './GradeFeedback';

const POLL_MS = 15_000;

export default function GradeResultView({
  taskId,
  awaitingSubmission = false,
  attemptId,
}: {
  taskId: string;
  attemptId?: string;
  awaitingSubmission?: boolean;
}) {
  const [grade, setGrade] = useState<Grade | null>(null);
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    const load = async () => {
      let next: Grade | null = null;
      try {
        next = (await (attemptId
          ? api('study-grade', taskId, attemptId)
          : api('study-grade', taskId))) as Grade | null;
      } catch {
        // Results are additional to the submission, so a failed check stays
        // quiet and is tried again.
      }
      if (!active) return;
      if (next) setGrade(next);
      if (
        !next ||
        next.status === 'pending' ||
        (awaitingSubmission && next.status === 'none')
      )
        timer = window.setTimeout(load, POLL_MS);
    };
    load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [taskId, awaitingSubmission, attemptId]);

  if ((!grade || grade.status === 'none') && !awaitingSubmission) return null;
  if (!grade || grade.status === 'none' || grade.status === 'pending')
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
        <p className="grade-correction" role="status">
          <strong>Updated by the study team:</strong> {grade.correction_note}
        </p>
      )}
      {grade.feedback && <GradeFeedback text={grade.feedback} />}
      {Boolean(grade.sections?.length) && (
        <div className="grade-breakdown">
          <h4>Score breakdown</h4>
          <dl className="grade-sections">
            {grade.sections!.map((section) => (
              <div key={section.label}>
                <dt>{section.label}</dt>
                <dd>
                  <span>
                    {section.score} / {section.max_score}
                  </span>
                  <span className="grade-section-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${section.max_score > 0 ? Math.min(100, Math.max(0, (section.score / section.max_score) * 100)) : 0}%`,
                      }}
                    />
                  </span>
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
        </div>
      )}
      {Boolean(grade.strengths?.length) && (
        <div className="grade-feedback-section grade-feedback-section--strengths">
          <h4>What went well</h4>
          <ul>
            {grade.strengths!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {Boolean(grade.gaps?.length) && (
        <div className="grade-feedback-section">
          <h4>What to improve</h4>
          <ul>
            {grade.gaps!.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
