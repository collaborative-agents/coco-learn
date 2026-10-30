import useModelChapter from './useModelChapter';
import useTokenChapter from './useTokenChapter';
import './AgenticQuest.css';
import useToolChapterProgress from './useToolChapterProgress';
import useContextChapterProgress from './useContextChapterProgress';

export const agentLevels = [
  {
    name: 'Tool',
    reward: 'Expand tool calls',
    detail: 'See which tools Coco uses and what they return.',
  },
  {
    name: 'Context',
    summary:
      'Context is the information available to a model when it responds: instructions, conversation history, documents, and tool results.',
    reward: 'Context button',
    detail: 'Explore the information Coco has available.',
  },
  {
    name: 'Token',
    summary:
      'Tokens measure the information a model processes, including text and images. Learn how input and output tokens contribute to AI cost.',
    reward: 'Token usage',
    detail: 'See usage for each request and track your totals in Settings.',
  },
  {
    name: 'Models',
    summary:
      'Choose models by capability, speed, and cost, and compare their perspectives for brainstorming and decisions.',
    reward: 'Model picker',
    detail: 'Choose the model for your task.',
  },
  {
    name: 'Workflow',
    summary:
      'A workflow connects instructions, model decisions, and tool calls into a sequence that completes a task. Clear checkpoints help you review the results.',
  },
];

function GiftIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11h16v10H4zM3 7h18v4H3zM12 7v14" />
      <path d="M12 7H8.5A2.5 2.5 0 1 1 11 4.5L12 7Zm0 0h3.5A2.5 2.5 0 1 0 13 4.5L12 7Z" />
    </svg>
  );
}

/** Chapter rewards reflect saved learning progress. */
export default function AgenticQuest({
  onOpen,
  adminMode,
}: {
  onOpen: (level: number) => void;
  adminMode: boolean;
}) {
  const progress = useToolChapterProgress();
  const contextProgress = useContextChapterProgress();
  const tokenProgress = useTokenChapter();
  const modelProgress = useModelChapter();
  const completedLevels = [
    ...(progress.completedAt ? [1] : []),
    ...(contextProgress.completedAt ? [2] : []),
    ...(tokenProgress.completedAt ? [3] : []),
    ...(modelProgress.completedAt ? [4] : []),
  ];
  const currentChapter = agentLevels.findIndex(
    (_, index) => !completedLevels.includes(index + 1),
  );
  return (
    <section className="agentic-quest" aria-label="Agent 101">
      <span className="agentic-quest-label">Agent 101</span>
      <ol
        className="agentic-quest-path"
        aria-label={
          adminMode
            ? 'Five chapters, admin preview'
            : `Five chapters, ${agentLevels[currentChapter]?.name ?? 'all chapters'} available`
        }
      >
        {agentLevels.map((level, index) => {
          const completed = completedLevels.includes(index + 1);
          const available =
            adminMode ||
            completed ||
            index === 0 ||
            completedLevels.includes(index);
          return (
            <li key={level.name} className="agentic-quest-stop">
              <button
                type="button"
                className={`agentic-quest-level${index === currentChapter ? ' agentic-quest-level--current' : ''}`}
                disabled={!available}
                aria-current={index === currentChapter ? 'step' : undefined}
                aria-label={`Chapter ${index + 1}: ${available ? `${level.name}. ${completed ? 'Complete' : 'Available'}` : `Locked, complete chapter ${index} first`}`}
                onClick={() => onOpen(index)}
              >
                <span className="agentic-quest-number">
                  {completedLevels.includes(index + 1) ? '✓' : index + 1}
                </span>
                <span>{available ? level.name : '??'}</span>
              </button>
              {level.reward && (
                <span className="agentic-quest-bridge">
                  <button
                    type="button"
                    className="agentic-quest-gift"
                    disabled={
                      !(adminMode || completedLevels.includes(index + 1))
                    }
                    aria-label={`Reward after chapter ${index + 1}: ${adminMode || completedLevels.includes(index + 1) ? level.reward : 'Locked'}`}
                    aria-describedby={
                      adminMode || completedLevels.includes(index + 1)
                        ? `quest-reward-${index}`
                        : undefined
                    }
                  >
                    <GiftIcon />
                  </button>
                  {(adminMode || completedLevels.includes(index + 1)) && (
                    <span
                      className="agentic-quest-tooltip"
                      role="tooltip"
                      id={`quest-reward-${index}`}
                    >
                      <strong>{level.reward}</strong>
                      <span>{level.detail}</span>
                    </span>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
