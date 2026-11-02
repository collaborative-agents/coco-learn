import TrainingDialog from './TrainingDialog';
import './ReflectionCompleted.css';

export default function ReflectionCompleted({
  day,
  onClose,
}: {
  day: number;
  onClose: () => void;
}) {
  return (
    <TrainingDialog open title="Practice complete" onClose={onClose}>
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
        <p>You completed Day {day}. Your reflection has been submitted.</p>
        <button type="button" className="training-primary" onClick={onClose}>
          Back to camp
        </button>
      </div>
    </TrainingDialog>
  );
}
