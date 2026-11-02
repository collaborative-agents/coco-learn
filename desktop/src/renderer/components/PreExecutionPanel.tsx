import { useCallback, useEffect, useState } from 'react';
import type { PostAssessmentState } from '../../shared/post-assessment';
import { ExecutionSection } from './PostAssessmentPanel';

const invoke = (
  channel: Parameters<typeof window.electron.ipcRenderer.invoke>[0],
  ...args: unknown[]
) => window.electron.ipcRenderer.invoke(channel, ...args);

export default function PreExecutionPanel({
  onSubmitted,
  legacyComplete,
}: {
  onSubmitted: () => Promise<void>;
  legacyComplete: boolean;
}) {
  const [state, setState] = useState<PostAssessmentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    const next = await invoke('pre-assessment-execution-state');
    if (!next || typeof next !== 'object' || !('sections' in next))
      throw new Error('The study server returned invalid execution progress.');
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
  if (legacyComplete)
    return (
      <p>
        Your earlier start check-in is complete. You do not need to submit the
        new execution task.
      </p>
    );
  return (
    <>
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
      {!state && !error && <p>Loading your execution task…</p>}
      {state && !state.unlocked && (
        <p>This execution task is not available yet.</p>
      )}
      {state?.unlocked && (
        <ExecutionSection
          preAssessment
          state={state}
          busy={busy}
          onStart={() => act(() => invoke('pre-assessment-start-execution'))}
          onDownload={() =>
            act(async () => {
              const result = (await invoke(
                'pre-assessment-download-toolkit',
              )) as { success?: boolean };
              if (result.success) setNotice('Toolkit file saved.');
            })
          }
          onChooseAnswerSheet={async () => {
            let filename: string | null = null;
            await act(async () => {
              const result = (await invoke(
                'pre-assessment-select-execution-files',
                'outcome',
              )) as { canceled?: boolean; filenames?: string[] };
              if (!result.canceled) filename = result.filenames?.[0] ?? null;
            });
            return filename;
          }}
          onSubmit={(questionnaire) =>
            act(() => invoke('pre-assessment-submit-execution', questionnaire))
          }
        />
      )}
    </>
  );
}
