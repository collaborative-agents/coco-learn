import { useState } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialog from './TrainingDialog';
import TokenUsageSettings from '../chat/TokenUsageSettings';
import './TrainingDialog.css';
import './TokenUsageUnlock.css';

export default function TokenUsageUnlock({
  user,
  completedAt,
  onSettings,
}: {
  user: string;
  completedAt: string;
  onSettings: () => void;
}) {
  const storageKey = `token-usage-guide:${user}:${completedAt}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(storageKey) !== 'seen';
    } catch {
      return true;
    }
  });
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, 'seen');
    } catch {
      // Closing must still work when storage is unavailable.
    }
  };
  if (!open) return null;
  return createPortal(
    <TrainingDialog open title="Chapter 3 passed! 🎉" onClose={close}>
      <div className="token-unlock-guide">
        <p>You can now see the tokens behind each request.</p>
        <div className="token-unlock-feature">
          <strong>Token usage viewer unlocked</strong>
          <p>
            Track your usage in{' '}
            <strong>Settings → Account → Token usage</strong>. Explore daily
            activity and compare usage across models.
          </p>
        </div>
        <div className="token-unlock-preview" aria-label="Token usage preview">
          <TokenUsageSettings />
        </div>
        <p>Input and output token counts also appear beneath each response.</p>
        <button
          type="button"
          onClick={() => {
            close();
            onSettings();
          }}
        >
          Open token usage
        </button>
      </div>
    </TrainingDialog>,
    document.body,
  );
}
