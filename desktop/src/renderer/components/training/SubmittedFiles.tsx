/* eslint-disable react/require-default-props -- Optional submission attempt. */
import { useState } from 'react';
import { api } from './training-api';
import './SubmittedFiles.css';

export default function SubmittedFiles({
  taskId,
  files,
  attemptId,
}: {
  taskId: string;
  files: string[];
  attemptId?: string;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  if (!files.length) return null;
  return (
    <div className="submitted-files">
      <strong>Submitted:</strong>
      <ul>
        {files.map((filename) => (
          <li key={filename}>
            <button
              type="button"
              disabled={saving !== null}
              aria-label={`Download ${filename}`}
              onClick={async () => {
                setSaving(filename);
                setError('');
                setNotice('');
                try {
                  const result = (await api(
                    'study-download-submission',
                    taskId,
                    filename,
                    ...(attemptId ? [attemptId] : []),
                  )) as { success?: boolean };
                  if (result.success) setNotice(`${filename} saved.`);
                } catch (reason) {
                  setError(
                    reason instanceof Error ? reason.message : String(reason),
                  );
                } finally {
                  setSaving(null);
                }
              }}
            >
              {filename}
              {saving === filename ? ' — Saving…' : ''}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="training-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
