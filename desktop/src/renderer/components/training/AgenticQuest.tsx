import './AgenticQuest.css';

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
      'Tokens are the chunks of text a model processes. Inputs and outputs both use tokens, and models have limits on how many they can handle at once.',
    reward: 'Token usage',
    detail: 'See how many tokens your conversation uses.',
  },
  {
    name: 'Models',
    summary:
      'Models power an agent’s reasoning and responses. Different models offer different capabilities, speed, and cost.',
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

/** Initial quest design; completion and feature entitlements are not yet connected. */
export default function AgenticQuest({
  onOpen,
  adminMode,
}: {
  onOpen: (level: number) => void;
  adminMode: boolean;
}) {
  // No rewards are unlocked in the initial design preview.
  const completedLevels: number[] = [];
  return (
    <section className="agentic-quest" aria-label="Agent 101">
      <span className="agentic-quest-label">Agent 101</span>
      <ol
        className="agentic-quest-path"
        aria-label={
          adminMode
            ? 'Five levels, admin preview'
            : 'Five levels, Tool available'
        }
      >
        {agentLevels.map((level, index) => (
          <li key={level.name} className="agentic-quest-stop">
            <button
              type="button"
              className={`agentic-quest-level${index === 0 ? ' agentic-quest-level--current' : ''}`}
              disabled={!adminMode && index !== 0}
              aria-current={index === 0 ? 'step' : undefined}
              aria-label={`Level ${index + 1}: ${adminMode || index === 0 ? `${level.name}. Available` : `Locked, complete level ${index} first`}`}
              onClick={() => onOpen(index)}
            >
              <span className="agentic-quest-number">{index + 1}</span>
              <span>{adminMode || index === 0 ? level.name : '??'}</span>
            </button>
            {level.reward && (
              <span className="agentic-quest-bridge">
                <button
                  type="button"
                  className="agentic-quest-gift"
                  disabled={!(adminMode || completedLevels.includes(index + 1))}
                  aria-label={`Reward after level ${index + 1}: ${adminMode || completedLevels.includes(index + 1) ? level.reward : 'Locked'}`}
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
                    <span className="agentic-quest-tooltip-kicker">
                      Reward for completing {level.name}
                    </span>
                    <strong>{level.reward}</strong>
                    <span>{level.detail}</span>
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
