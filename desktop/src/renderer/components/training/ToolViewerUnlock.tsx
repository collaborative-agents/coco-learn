import { useState } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialog from './TrainingDialog';
import ToolViewerAccess from '../chat/ToolViewerAccess';
import { ToolCallCard } from '../chat/ToolCallCard';
import './TrainingDialog.css';
import './ToolViewerUnlock.css';

/** Acknowledge the guide separately from the persisted chapter entitlement. */
export default function ToolViewerUnlock({
  user,
  completedAt,
}: {
  user: string;
  completedAt: string;
}) {
  const storageKey = `tool-viewer-guide:${user}:${completedAt}`;
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
      // Storage availability must not prevent closing the guide.
    }
  };
  if (!open) return null;
  return createPortal(
    <div className="tool-viewer-unlock">
      <TrainingDialog open title="Chapter 1 passed! 🎉" onClose={close}>
        <div className="tool-viewer-guide">
          <p>
            <strong>Tool viewer unlocked.</strong> Open Details on a tool call
            to see what Coco did and what came back.
          </p>
          <figure className="tool-viewer-example">
            <figcaption>Try it here · Reading a file</figcaption>
            <ToolViewerAccess.Provider value>
              <ToolCallCard
                call={{
                  id: 'example',
                  name: 'bash',
                  arguments: { command: 'cat notes.txt' },
                  status: 'completed',
                  result: { output: 'Team meeting at 10 AM.' },
                }}
              />
            </ToolViewerAccess.Provider>
            <div className="tool-viewer-example-notes">
              <div>
                <code>name</code>
                <span>The tool Coco used, like Bash.</span>
              </div>
              <div>
                <code>arguments</code>
                <span>
                  What Coco asked it to do. Here, read <code>notes.txt</code>.
                </span>
              </div>
              <div>
                <code>result</code>
                <span>What came back. Here, the text inside the file.</span>
              </div>
            </div>
          </figure>
        </div>
      </TrainingDialog>
    </div>,
    document.body,
  );
}
