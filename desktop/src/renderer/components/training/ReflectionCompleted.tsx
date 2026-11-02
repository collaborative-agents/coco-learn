/* eslint-disable react/require-default-props -- Shared completion dialog defaults. */
import TrainingDialog from './TrainingDialog';
import './ReflectionCompleted.css';

export default function ReflectionCompleted({
  day = 0,
  assessment = false,
  onClose,
}: {
  day?: number;
  assessment?: boolean;
  onClose: () => void;
}) {
  return (
    <TrainingDialog
      open
      title={assessment ? 'Mission complete' : 'Practice complete'}
      onClose={onClose}
    >
      <div className="reflection-completed">
        <div className="reflection-completed-sparkles" aria-hidden>
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} style={{ transform: `rotate(${index * 30}deg)` }} />
          ))}
        </div>
        <div className="reflection-completed-icon" aria-hidden>
          🎉
        </div>
        <h2>Congratulations!</h2>
        <p>
          {assessment
            ? 'Your answer sheet, activity report, and reflection have been submitted.'
            : `You completed Day ${day}. Your reflection has been submitted.`}
        </p>
        <button type="button" className="training-primary" onClick={onClose}>
          {assessment ? 'View submission' : 'Back to camp'}
        </button>
      </div>
    </TrainingDialog>
  );
}
