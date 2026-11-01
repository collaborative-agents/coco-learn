import { useEffect, useRef, useState } from 'react';
import type { TokenTrainingSession } from '../../../shared/token-training';
import { S } from '../chat/styles';
import './TokenChapter.css';

export default function TokenTrainingQuestion({
  session,
  completedAt,
  busy,
}: {
  session: TokenTrainingSession | null;
  completedAt: string | null;
  busy: boolean;
}) {
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const visible = Boolean(
    session && session.requests.length >= 2 && !completedAt,
  );
  useEffect(() => {
    if (visible) messageRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [visible]);
  if (!session || !visible) return null;
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
    <div ref={messageRef} style={S.tutorRow} aria-label="Token usage question">
      <div style={S.tutorAvatar} aria-hidden="true">
        C
      </div>
      <div style={{ ...S.tutorBubble, minWidth: 0 }}>
        <p className="token-question-intro">
          Compare the output counts: a more detailed answer often uses more
          output tokens.
        </p>
        <fieldset className="token-quiz" disabled={saving || busy}>
          <legend>Why can a short follow-up use many input tokens?</legend>
          <button type="button" onClick={() => answer('words')}>
            Each word always counts as many tokens.
          </button>
          <button type="button" onClick={() => answer('context')}>
            The model also receives earlier conversation and other context.
          </button>
          <button type="button" onClick={() => answer('answer')}>
            Input tokens measure the length of the answer.
          </button>
        </fieldset>
        {feedback && <p role="status">{feedback}</p>}
      </div>
    </div>
  );
}
