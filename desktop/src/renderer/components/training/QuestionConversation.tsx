/* eslint-disable react/require-default-props -- React 19 uses default function parameters. */
import { useEffect, useRef, useState } from 'react';
import './QuestionConversation.css';

export interface ConversationQuestion<Id extends string> {
  id: Id;
  label?: string;
  text: string;
}

/**
 * Presents fixed written questions one at a time as a scripted chat. No model
 * is involved, so every participant sees identical wording. The parent owns the
 * committed answers; which question is current is derived from them.
 */
export default function QuestionConversation<Id extends string>({
  questions,
  answers,
  onAnswerChange,
  idPrefix,
  minLength = 1,
  maxLength,
  disabled = false,
  readOnly = false,
}: {
  questions: readonly ConversationQuestion<Id>[];
  answers: Readonly<Record<Id, string>>;
  onAnswerChange: (id: Id, value: string) => void;
  idPrefix: string;
  minLength?: number;
  maxLength?: number;
  disabled?: boolean;
  readOnly?: boolean;
}) {
  const [drafts, setDrafts] = useState<Partial<Record<Id, string>>>({});
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const meetsMinimum = (value: string) => value.trim().length >= minLength;
  const currentIndex = readOnly
    ? -1
    : questions.findIndex(({ id }) => !meetsMinimum(answers[id]));
  const currentId = currentIndex >= 0 ? questions[currentIndex].id : null;

  // Follow the conversation as it advances, without taking focus on mount: the
  // form may be mounted behind another step.
  const previousIdRef = useRef(currentId);
  useEffect(() => {
    if (previousIdRef.current === currentId) return;
    previousIdRef.current = currentId;
    composerRef.current?.focus();
    composerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [currentId]);

  const setDraft = (id: Id, value: string) =>
    setDrafts((current) => ({ ...current, [id]: value }));

  const send = (id: Id) => {
    const draft = drafts[id] ?? '';
    if (disabled || !meetsMinimum(draft)) return;
    onAnswerChange(id, draft);
    setDraft(id, '');
  };

  // Reopening clears the committed answer, which also keeps the parent's submit
  // disabled until the edited answer is sent again.
  const edit = (id: Id) => {
    setDraft(id, answers[id]);
    onAnswerChange(id, '');
  };

  return (
    <div className="question-conversation" role="log" aria-live="polite">
      {questions.map(({ id, label, text }, index) => {
        const isCurrent = index === currentIndex;
        const answered = meetsMinimum(answers[id]);
        if (!readOnly && !isCurrent && !answered) return null;
        const prompt = label ? `${label} ${text}` : text;
        const draft = drafts[id] ?? '';
        return (
          <div className="question-conversation-turn" key={id}>
            <p className="question-conversation-question">{prompt}</p>
            {answered && (
              <div className="question-conversation-answer">
                <p>{answers[id]}</p>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Edit answer: ${prompt}`}
                    disabled={
                      disabled || (currentIndex >= 0 && index > currentIndex)
                    }
                    onClick={() => edit(id)}
                  >
                    Edit
                  </button>
                )}
              </div>
            )}
            {isCurrent && (
              <div className="question-conversation-composer">
                <textarea
                  id={`${idPrefix}-${id}`}
                  ref={composerRef}
                  rows={3}
                  aria-label={prompt}
                  placeholder="Type your answer…"
                  maxLength={maxLength}
                  value={draft}
                  disabled={disabled}
                  onChange={(event) => setDraft(id, event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      send(id);
                    }
                  }}
                />
                <div className="question-conversation-composer-actions">
                  <small>Enter to send · Shift + Enter for a new line</small>
                  <button
                    type="button"
                    disabled={disabled || !meetsMinimum(draft)}
                    onClick={() => send(id)}
                  >
                    Send answer
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
