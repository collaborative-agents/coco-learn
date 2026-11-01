import trainingAnimation from '../../../../assets/training.gif';
import './TrainingProgress.css';

export interface ChallengeStep {
  id: string;
  label: string;
  accessibleLabel: string;
  complete: boolean;
  available: boolean;
  onClick: () => void;
}

function TaskIcon({ training }: { training: boolean }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {training ? (
        <path d="M12 5v15M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z" />
      ) : (
        <>
          <rect x="8" y="3" width="8" height="4" rx="1" />
          <path d="M8 5H5v16h14V5h-3M8 12h8M8 16h5" />
        </>
      )}
    </svg>
  );
}

function stepMarker(step: ChallengeStep) {
  if (step.complete) return '✓';
  if (step.id.startsWith('day-')) return step.label;
  return <TaskIcon training={false} />;
}

export default function TrainingProgress({
  steps,
}: {
  steps: ChallengeStep[];
}) {
  const completed = steps.filter((step) => step.complete).length;
  const current = steps.find((step) => !step.complete && step.available)?.id;
  const groups = [
    { label: 'Start check-in', training: false, steps: steps.slice(0, 1) },
    { label: '7-day training', training: true, steps: steps.slice(1, 8) },
    { label: 'Final check-in', training: false, steps: steps.slice(8, 9) },
    { label: 'Follow-up', training: false, steps: steps.slice(9) },
  ];
  return (
    <section className="training-progress" aria-label="Learning progress">
      <div className="training-progress-header">
        <img
          className="training-progress-avatar"
          src={trainingAnimation}
          alt=""
          draggable={false}
        />
        <div className="training-progress-label">
          <strong>Learning progress</strong>
          <span
            role="progressbar"
            aria-label="Learning progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completed}
            aria-valuetext={`${completed} of ${steps.length} challenge items complete`}
          />
        </div>
      </div>
      <div className="training-progress-scroll">
        <div className="training-milestones">
          {groups.map((group) => (
            <div
              className={`training-milestone-group training-milestone-group--${group.training ? 'training' : 'assessment'}`}
              key={group.label}
            >
              <div className="training-milestone-steps">
                {group.steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    className={`training-milestone${step.complete ? ' is-complete' : ''}${step.id === current ? ' is-current' : ''}`}
                    disabled={!step.available}
                    onClick={step.onClick}
                    aria-label={`${step.accessibleLabel}${step.complete ? ' — Complete' : ''}`}
                    aria-current={step.id === current ? 'step' : undefined}
                    title={
                      step.complete
                        ? `${step.accessibleLabel} — Complete`
                        : `${step.accessibleLabel}${step.available ? '' : ' — Locked'}`
                    }
                  >
                    <span
                      className="training-milestone-node"
                      aria-hidden="true"
                    >
                      {stepMarker(step)}
                    </span>
                  </button>
                ))}
              </div>
              <span className="training-milestone-label">
                <TaskIcon training={group.training} />
                {group.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="training-progress-hint">
        Book icons mark training tasks; clipboard icons mark assessments.
        Select an available step to continue. Grey steps unlock as you progress.
      </p>
    </section>
  );
}
