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

function AssessmentFlag() {
  return (
    <svg
      className="training-assessment-flag"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 21V3" />
      <path d="M5 4c5-4 9 4 14 0v11c-5 4-9-4-14 0Z" fill="currentColor" />
    </svg>
  );
}

function stepMarker(step: ChallengeStep) {
  if (step.complete) return '✓';
  if (step.id.startsWith('day-')) return step.label;
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
      <path d="M5 19V5M5 19h15M9 14l4-4 3 2 4-6" />
    </svg>
  );
}

export default function TrainingProgress({
  steps,
}: {
  steps: ChallengeStep[];
}) {
  const completed = steps.filter((step) => step.complete).length;
  const current = steps.find((step) => !step.complete && step.available)?.id;
  const groups = [
    { label: 'Start check-in', steps: steps.slice(0, 1) },
    { label: '7-day training', steps: steps.slice(1, 8) },
    { label: 'Final check-in', steps: steps.slice(8, 9) },
    { label: 'Follow-up', steps: steps.slice(9) },
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
            <div className="training-milestone-group" key={group.label}>
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
                    {!step.id.startsWith('day-') && <AssessmentFlag />}
                    <span
                      className="training-milestone-node"
                      aria-hidden="true"
                    >
                      {stepMarker(step)}
                    </span>
                  </button>
                ))}
              </div>
              <span className="training-milestone-label">{group.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="training-progress-hint">
        Select an available step to continue. Grey steps unlock as you progress.
      </p>
    </section>
  );
}
