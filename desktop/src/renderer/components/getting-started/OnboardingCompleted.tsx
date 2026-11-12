import { useState } from 'react';
import { createPortal } from 'react-dom';
import TrainingDialog from '../training/TrainingDialog';
import '../training/TrainingDialog.css';
import '../training/ToolViewerUnlock.css';
import '../training/ReflectionCompleted.css';

export default function OnboardingCompleted({ sessionId, onClose }: {
  sessionId: string; onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const explore = async () => {
    setOpening(true);
    try {
      const result = await window.electron?.ipcRenderer.invoke('runner-action', { sessionId, action: 'open-training' });
      if (result?.error) throw Error(result.error);
      onClose();
    } catch {
      setError('Couldn’t open Training. Please try again.');
    } finally { setOpening(false); }
  };
  return createPortal(<div className="tool-viewer-unlock">
    <TrainingDialog open title="Your first project with Coco" onClose={onClose}>
      <div className="reflection-completed">
        <div className="reflection-completed-icon" aria-hidden>🎉</div>
        <h2>Congratulations!</h2>
        <p>You built a game with Coco, made it yours, and checked the result.</p>
        <p>Keep going with Agent 101: short lessons to build your skills and unlock more chat tools.</p>
        <button className="training-primary" type="button" disabled={opening} onClick={() => void explore()}>
          {opening ? 'Opening…' : 'Explore Agent 101'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </TrainingDialog>
  </div>, document.body);
}
