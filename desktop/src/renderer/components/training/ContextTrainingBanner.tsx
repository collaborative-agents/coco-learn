import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  contextPracticePrompts,
  type ContextTrainingSession,
} from '../../../shared/context-training';
import useContextChapterProgress from './useContextChapterProgress';
import TrainingDialog from './TrainingDialog';
import ContextComposition from '../chat/ContextComposition';
import type { AgentContextSnapshot } from '../../../shared/agent-context';
import './ToolTrainingBanner.css';
import './ContextTrainingBanner.css';
import './TrainingDialog.css';

function ContextUnlock({
  user,
  completedAt,
  sessionId,
}: {
  user: string;
  completedAt: string;
  sessionId: string;
}) {
  const key = `context-viewer-guide:${user}:${completedAt}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'seen';
    } catch {
      return true;
    }
  });
  const [snapshot, setSnapshot] = useState<AgentContextSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setSnapshot(null);
    window.electron.ipcRenderer
      .invoke('get-agent-context', sessionId)
      .then((value) => {
        if (active) setSnapshot(value ?? null);
        return undefined;
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, sessionId]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, 'seen');
    } catch {
      /* Optional acknowledgement. */
    }
  };
  if (!open) return null;
  return createPortal(
    <div className="context-training-unlock">
      <TrainingDialog open title="Chapter 2 passed! 🎉" onClose={close}>
        <p className="context-training-unlock-intro">
          <strong>Context viewer unlocked.</strong> Click Context beside the
          message box to inspect what Coco receives.
        </p>
        <div
          className="context-training-preview"
          aria-label="Context viewer guide"
        >
          {loading && <p role="status">Loading context…</p>}
          {!loading && snapshot && <ContextComposition snapshot={snapshot} />}
          {!loading && !snapshot && (
            <p>Open Context after your next message to see the breakdown.</p>
          )}
        </div>
      </TrainingDialog>
    </div>,
    document.body,
  );
}

const steps = [
  {
    key: 'workspaceSet',
    label: 'Set a workspace',
    instruction:
      'Choose a working folder below, then ask Coco what that gives it access to.',
    action: 'Ask about the workspace',
  },
  {
    key: 'fileLinked',
    label: 'Link a file',
    instruction:
      'Attach a text file from that folder with the paperclip, then ask what the link adds.',
    action: 'Ask about the file link',
  },
  {
    key: 'fileRead',
    label: 'Read the file',
    instruction:
      'Ask Coco to read the linked file and explain what it can now see.',
    action: 'Ask Coco to read it',
  },
] as const;

export default function ContextTrainingBanner({
  sessionId,
  onPrompt,
  busy,
}: {
  sessionId: string | null;
  onPrompt: (prompt: string) => void;
  busy: boolean;
}) {
  const [session, setSession] = useState<ContextTrainingSession | null>(null);
  const progress = useContextChapterProgress();
  useEffect(() => {
    let active = true;
    setSession(null);
    if (sessionId)
      window.electron.ipcRenderer
        .invoke('context-chapter-session', sessionId)
        .then((value) => {
          if (active) setSession(value);
          return undefined;
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId]);
  const currentStep = steps.findIndex((step) => !progress[step.key]);
  if (!session || session.sessionId !== sessionId) return null;
  return (
    <aside
      className="tool-training-banner context-training-banner"
      aria-label="Chapter 2 training"
    >
      <div className="tool-training-heading">
        <strong>Chapter 2 · Context: See what Coco can see</strong>
      </div>
      <ol
        className="tool-training-goals"
        aria-label="Context chapter goals"
        aria-live="polite"
      >
        {steps.map((step, index) => {
          const complete = progress[step.key];
          if (!complete && index !== currentStep) return null;
          return (
            <li
              key={step.key}
              className={`tool-training-goal${complete ? ' is-complete' : ''}`}
              aria-label={`${step.label}: ${complete ? 'Complete' : 'Not yet'}`}
              aria-current={index === currentStep ? 'step' : undefined}
            >
              <div className="context-training-todo-title">
                <span className="tool-training-goal-icon" aria-hidden="true">
                  {complete ? '✓' : index + 1}
                </span>
                <strong>{step.label}</strong>
              </div>
              {!complete && (
                <div className="context-training-prompt">
                  <p>{step.instruction}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPrompt(contextPracticePrompts[index])}
                  >
                    {step.action}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {progress.completedAt && (
        <ContextUnlock
          key={`${session.user}:${progress.completedAt}`}
          user={session.user}
          sessionId={session.sessionId}
          completedAt={progress.completedAt}
        />
      )}
    </aside>
  );
}
