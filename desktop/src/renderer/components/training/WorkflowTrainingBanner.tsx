import type { WorkflowSession } from '../../../shared/workflow-training';
import './ToolTrainingBanner.css';
import './WorkflowTrainingBanner.css';

export default function WorkflowTrainingBanner({
  session,
}: {
  session: WorkflowSession | null;
}) {
  if (!session) return null;
  const tested = session.trials.some(
    (trial) => trial.draftVersion === session.version,
  );
  const goals = [
    { label: 'Create a skill', complete: Boolean(session.draft) },
    { label: 'Test the latest version', complete: tested },
    { label: 'Confirm saving', complete: Boolean(session.savedSkillId) },
    {
      label: 'Save to curated skills',
      complete: Boolean(session.savedSkillId),
    },
  ];
  const next = goals.findIndex((goal) => !goal.complete);
  let hint =
    'Tell Coco about a task you do repeatedly and how you like to work.';
  if (session.draft)
    hint =
      'Review your skill in the chat, then give Coco a real example to test it.';
  if (tested)
    hint =
      'Tell Coco what to improve, or ask to save the skill when you’re happy with the result.';
  return (
    <aside
      className="tool-training-banner workflow-training-banner"
      aria-label="Chapter 5 training"
    >
      <strong>Chapter 5 · Workflow: Build your own skill</strong>
      <ul
        className="tool-training-goals"
        aria-label="Chapter 5 goals"
        aria-live="polite"
      >
        {goals.map((goal, index) => (
          <li
            key={goal.label}
            className={`tool-training-goal${goal.complete ? ' is-complete' : ''}`}
            aria-label={`${goal.label}: ${goal.complete ? 'Complete' : 'Not yet'}`}
            aria-current={index === next ? 'step' : undefined}
          >
            <span className="tool-training-goal-icon" aria-hidden="true">
              {goal.complete ? '✓' : index + 1}
            </span>
            <span>{goal.label}</span>
          </li>
        ))}
      </ul>
      {session.savedSkillId ? (
        <>
          <p>
            Your skill is saved. Choose it from Skills in the chat input bar.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('coco:open-skills'))}
          >
            Browse my skills
          </button>
        </>
      ) : (
        <>
          <p>
            Work with Coco to create, test, and refine a reusable skill for
            yourself.
          </p>
          <p>{hint}</p>
        </>
      )}
    </aside>
  );
}
