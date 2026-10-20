import { useCallback, useEffect, useState } from 'react';
import type { PostAssessmentState } from '../../shared/post-assessment';
import { ExecutionSection } from './PostAssessmentPanel';

const invoke = (
  channel: Parameters<typeof window.electron.ipcRenderer.invoke>[0],
  ...args: unknown[]
) => window.electron.ipcRenderer.invoke(channel, ...args);

export default function FollowUpAssessmentPanel({
  onSubmitted,
}: {
  onSubmitted: () => Promise<void>;
}) {
  const [state, setState] = useState<PostAssessmentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const next = await invoke('follow-up-assessment-state');
    if (!next || typeof next !== 'object' || !('sections' in next))
      throw new Error('The study server returned invalid follow-up progress.');
    setState(next as PostAssessmentState);
  }, []);
  useEffect(() => {
    load().catch((reason) => setError(String(reason)));
  }, [load]);
  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      await load();
      await onSubmitted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className={`training-card post-assessment${state?.complete ? ' post-assessment--complete' : ''}`}
    >
      {state?.complete && (
        <div className="post-assessment-intro">
          <h2>Follow-up assignment complete!</h2>
        </div>
      )}
      {error && (
        <p className="training-error" role="alert">
          {error}
          <button type="button" onClick={() => act(load)}>
            Retry
          </button>
        </p>
      )}
      {notice && (
        <p className="training-notice" role="status">
          {notice}
        </p>
      )}
      {!state && !error && <p>Loading your follow-up assignment…</p>}
      {state && !state.unlocked && (
        <p>
          Your follow-up assignment unlocks seven days after completing the
          post-assessment.
        </p>
      )}
      {state?.unlocked && (
        <ExecutionSection
          followUp
          state={state}
          busy={busy}
          onStart={() =>
            act(() => invoke('follow-up-assessment-start-execution'))
          }
          onDownload={() =>
            act(async () => {
              const result = (await invoke(
                'follow-up-assessment-download-toolkit',
              )) as { success?: boolean };
              if (result.success) setNotice('Toolkit file saved.');
            })
          }
          onChooseAnswerSheet={async () => {
            let filename: string | null = null;
            await act(async () => {
              const result = (await invoke(
                'follow-up-assessment-select-execution-files',
                'outcome',
              )) as { canceled?: boolean; filenames?: string[] };
              if (!result.canceled) filename = result.filenames?.[0] ?? null;
            });
            return filename;
          }}
          onSubmit={(questionnaire) =>
            act(() =>
              invoke('follow-up-assessment-submit-execution', questionnaire),
            )
          }
        />
      )}
    </section>
  );
}
