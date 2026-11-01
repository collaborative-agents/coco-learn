import {
  tokenPracticePrompts,
  type TokenTrainingSession,
} from '../../../shared/token-training';
import './ToolTrainingBanner.css';
import './TokenChapter.css';
import TokenUsageUnlock from './TokenUsageUnlock';

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
  if (!session) return null;
  const step = session.requests.length;
  const goals = [
    { label: 'Send a request', complete: step >= 1 || Boolean(completedAt) },
    { label: 'Ask a follow-up', complete: step >= 2 || Boolean(completedAt) },
    { label: 'Understand token usage', complete: Boolean(completedAt) },
  ];
  return (
    <aside
      className="tool-training-banner token-training-banner"
      aria-label="Chapter 3 training"
    >
      <div className="tool-training-heading">
        <strong>Chapter 3 · Token: See what your request uses</strong>
      </div>
      <ul className="tool-training-goals" aria-label="Chapter goals">
        {goals.map(({ label, complete }, index) => (
          <li
            key={label}
            className={`tool-training-goal${complete ? ' is-complete' : ''}`}
            aria-label={`${label}: ${complete ? 'Complete' : 'Not yet'}`}
          >
            <span className="tool-training-goal-icon" aria-hidden="true">
              {complete ? '✓' : index + 1}
            </span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {completedAt ? (
        <>
          <TokenUsageUnlock
            key={`${session.user}:${completedAt}`}
            user={session.user}
            completedAt={completedAt}
            onSettings={onSettings}
          />
          <p>
            <strong>Token tracking unlocked!</strong> See usage beneath each
            response and track it in Settings → Account → Token usage.
          </p>
          <button type="button" onClick={onSettings}>
            View token usage in Settings
          </button>
        </>
      ) : (
        <>
          {step === 0 && (
            <p>
              Ask for a one-sentence answer and inspect its input and output
              tokens.
            </p>
          )}
          {step === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPrompt(tokenPracticePrompts[step])}
            >
              Use one-sentence prompt
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
        </>
      )}
    </aside>
  );
}
