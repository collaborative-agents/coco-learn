import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkflowSession } from '../../../shared/workflow-training';
import TrainingDialog from './TrainingDialog';
import './TrainingDialog.css';
import SkillIcon from '../chat/SkillIcon';
import { TutorMessage } from '../chat/MessageContent';
import './WorkflowUnlock.css';

/** Only the completion guide; the quest uses the normal chat components. */
export default function WorkflowUnlock({
  session,
}: {
  session: WorkflowSession;
}) {
  const key = `workflow-skill-guide:${session.user}:${session.savedSkillId}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'seen';
    } catch {
      return true;
    }
  });
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, 'seen');
    } catch {
      /* Optional acknowledgement. */
    }
  };
  return createPortal(
    <div className="tool-viewer-unlock">
      {open && (
        <TrainingDialog
          open
          title="Chapter 5 passed! 🎉"
          onClose={close}
          className="workflow-unlock-dialog"
        >
          <p className="workflow-unlock-intro">
            You’ve turned your workflow into a reusable skill.
          </p>
          {session.draft && (
            <article className="workflow-unlock-skill">
              <div className="workflow-unlock-skill-heading">
                <SkillIcon size={24} />
                <div>
                  <h3>{session.draft.name}</h3>
                  <span className="workflow-unlock-saved">
                    ✓ Saved to your skills
                  </span>
                </div>
              </div>
              <p>{session.draft.description}</p>
              <details className="workflow-skill-disclosure">
                <summary>View your skill</summary>
                <div
                  className="workflow-skill-document"
                  role="region"
                  aria-label="Skill instructions"
                  tabIndex={0}
                >
                  <TutorMessage text={session.draft.instructions} />
                  {session.draft.files.map((file) => (
                    <details key={file.name}>
                      <summary>{file.name}</summary>
                      <TutorMessage text={file.content} />
                    </details>
                  ))}
                </div>
              </details>
            </article>
          )}
          <div className="workflow-unlock-tip">
            <h3>Bring it into your next conversation</h3>
            <p>
              Choose the star in the input bar to add a skill to your message.
            </p>
            <div
              className="workflow-composer-preview"
              role="img"
              aria-label="Chat input bar with the star Skills button highlighted"
            >
              <span className="workflow-composer-placeholder">Ask Coco…</span>
              <div
                className="workflow-composer-preview-tools"
                aria-hidden="true"
              >
                <span>+</span>
                <span className="workflow-composer-star">
                  <SkillIcon />
                  <span>Skills</span>
                </span>
                <span className="workflow-composer-send">↑</span>
              </div>
            </div>
          </div>
        </TrainingDialog>
      )}
    </div>,
    document.body,
  );
}
