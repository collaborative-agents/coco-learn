import { useEffect, useId, useState } from 'react';
import GradeResultView from './GradeResultView';
import SubmittedFiles from './SubmittedFiles';
import { api, format } from './training-api';
import './SubmissionAttempts.css';

interface Attempt {
  id: string;
  submitted_at: string;
  files: string[];
}

export default function SubmissionAttempts({
  taskId,
  files,
}: {
  taskId: string;
  files: string[];
}) {
  const id = useId();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    api('study-submission-attempts', taskId)
      .then((response: { attempts?: Attempt[] }) => {
        if (!active) return undefined;
        if (!Array.isArray(response?.attempts))
          throw new Error('Invalid submission history.');
        setAttempts(response.attempts);
        return undefined;
      })
      .catch(() => {
        if (active) setError('Earlier submissions could not be loaded.');
      });
    return () => {
      active = false;
    };
  }, [taskId, retry]);
  const attempt =
    attempts.find((entry) => entry.id === selected) ?? attempts[0];
  return (
    <div className="submission-attempts">
      {attempts.length > 1 && (
        <label className="submission-attempt-picker" htmlFor={id}>
          <span>Submission attempt</span>
          <select
            id={id}
            value={attempt?.id ?? ''}
            onChange={(event) => setSelected(event.target.value)}
          >
            {attempts.map((entry, index) => (
              <option key={entry.id} value={entry.id}>
                Attempt {attempts.length - index}
                {index === 0 ? ' (latest)' : ''} · {format(entry.submitted_at)}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry history
          </button>
        </p>
      )}
      <SubmittedFiles
        key={`files-${attempt?.id ?? 'latest'}`}
        taskId={taskId}
        files={attempt?.files ?? files}
        attemptId={attempt?.id}
      />
      <GradeResultView
        key={attempt?.id ?? 'latest'}
        taskId={taskId}
        attemptId={attempt?.id}
        awaitingSubmission={Boolean(files.length)}
      />
    </div>
  );
}
