import { useEffect, useState } from 'react';
import type { ToolTrainingSession } from '../../../shared/tool-exploration';
import useToolChapterProgress from './useToolChapterProgress';
import './ToolTrainingBanner.css';
import ToolViewerUnlock from './ToolViewerUnlock';

export default function ToolTrainingBanner({
  sessionId,
  comparison = false,
}: {
  sessionId: string | null | undefined;
  // eslint-disable-next-line react/require-default-props -- Uses a parameter default.
  comparison?: boolean;
}) {
  const [session, setSession] = useState<ToolTrainingSession | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const progress = useToolChapterProgress();
  useEffect(() => {
    let active = true;
    setSession(null);
    setError('');
    if (sessionId)
      window.electron.ipcRenderer
        .invoke('tool-chapter-session', sessionId)
        .then((value) => {
          if (active) setSession(value);
          return undefined;
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId]);
  const goals = [
    ['externalInformation', 'Ask a question that will trigger a tool call'],
    ['approved', 'Approve a tool call'],
    ['denied', 'Deny a tool call'],
  ] as const;
  if (!session) return null;
  return (
    <aside className="tool-training-banner" aria-label="Chapter 1 training">
      <div className="tool-training-heading">
        <strong>Chapter 1 · Tool: Explore the power of tool calls</strong>
        {!comparison && (
          <button
            type="button"
            disabled={switching}
            onClick={async () => {
              setSwitching(true);
              setError('');
              try {
                await window.electron.ipcRenderer.invoke(
                  'tool-chapter-switch',
                  session.sessionId,
                );
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : String(reason),
                );
              } finally {
                setSwitching(false);
              }
            }}
          >
            {switching
              ? 'Switching…'
              : `Try ${session.mode === 'with' ? 'without' : 'with'} tools`}
          </button>
        )}
      </div>
      <ul className="tool-training-goals" aria-label="Chapter goals">
        {goals.map(([key, label], index) => (
          <li
            key={key}
            className={`tool-training-goal${progress[key] ? ' is-complete' : ''}`}
            aria-label={`${label}: ${progress[key] ? 'Complete' : 'Not yet'}`}
          >
            <span className="tool-training-goal-icon" aria-hidden="true">
              {progress[key] ? '✓' : index + 1}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {progress.completedAt && (
        <ToolViewerUnlock
          key={`${session.user}:${progress.completedAt}`}
          user={session.user}
          completedAt={progress.completedAt}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
