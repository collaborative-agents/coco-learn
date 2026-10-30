import { useState } from 'react';
import {
  tokenPracticePrompts,
  type TokenTrainingSession,
} from '../../../shared/token-training';
import './ToolTrainingBanner.css';
import './TokenChapter.css';

export default function TokenTrainingBanner({
  session,
  completedAt,
  onPrompt,
  onSettings,
  busy,
}: {
  session: TokenTrainingSession | null;
  completedAt: string | null;
  onPrompt: (prompt: string) => void;
  onSettings: () => void;
  busy: boolean;
}) {
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  if (!session) return null;
  const step = session.requests.length;
  const answer = async (choice: string) => {
    setSaving(true);
    setFeedback('');
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'token-chapter-answer',
        session.sessionId,
        choice,
      );
      setFeedback(
        result?.correct
          ? 'Correct! Input includes earlier conversation and other context sent to the model.'
          : 'Try again: input is everything sent to the model, including earlier conversation and instructions.',
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Could not save your answer. Please retry.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <aside className="tool-training-banner" aria-label="Chapter 3 training">
      <strong>Chapter 3 · Token: See what your request uses</strong>
      {completedAt ? (
        <>
          <p>
            <strong>Token tracking unlocked!</strong> See usage beneath each
            response and track it in Settings → Token usage.
          </p>
          <button type="button" onClick={onSettings}>
            View token usage in Settings
          </button>
        </>
      ) : (
        <>
          <p>
            {step === 0
              ? '1. Send a request. Ask for a one-sentence answer and inspect its input and output tokens.'
              : '✓ First request recorded.'}
          </p>
          {step >= 1 && (
            <p>
              {step === 1
                ? '2. Ask a follow-up. Request more detail, then compare both requests below.'
                : '✓ Follow-up recorded.'}
            </p>
          )}
          {step < 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPrompt(tokenPracticePrompts[step])}
            >
              {step === 0 ? 'Use one-sentence prompt' : 'Use follow-up prompt'}
            </button>
          )}
          {step > 0 && (
            <table className="token-usage-table">
              <caption>Actual usage for your quest requests</caption>
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Input tokens</th>
                  <th scope="col">Output tokens</th>
                </tr>
              </thead>
              <tbody>
                {session.requests.map((request, index) => (
                  <tr key={request.requestId}>
                    <th scope="row">
                      {index === 0 ? 'First request' : 'Follow-up'}
                    </th>
                    <td>{request.input?.toLocaleString()}</td>
                    <td>{request.output?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {step < 2 && (
            <p className="token-note">
              Usage is previewed during this quest. If a reply has unavailable
              usage or is stopped, send another request to continue.
            </p>
          )}
          {step >= 2 && (
            <>
              <p>
                Compare the output counts: a more detailed answer often uses
                more output tokens. Input includes the context sent to the
                model, not just your latest prompt.
              </p>
              <fieldset className="token-quiz" disabled={saving || busy}>
                <legend>
                  3. Why can a short follow-up use many input tokens?
                </legend>
                <button type="button" onClick={() => answer('words')}>
                  Each word always counts as many tokens.
                </button>
                <button type="button" onClick={() => answer('context')}>
                  The model also receives earlier conversation and other
                  context.
                </button>
                <button type="button" onClick={() => answer('answer')}>
                  Input tokens measure the length of the answer.
                </button>
              </fieldset>
            </>
          )}
        </>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </aside>
  );
}
