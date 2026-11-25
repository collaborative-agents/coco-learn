import { useState } from 'react';
import useWorkflowChapter from './useWorkflowChapter';
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
    reward: 'Curated skills',
    detail: 'Browse and reuse your saved workflows in Settings.',
    summary:
      'Explore ways to collaborate with agents, then turn your preferred workflow into a reusable skill.',
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpPreview, setHelpPreview] = useState(false);
  const progress = useToolChapterProgress();
  const contextProgress = useContextChapterProgress();
  const tokenProgress = useTokenChapter();
  const modelProgress = useModelChapter();
  const workflowProgress = useWorkflowChapter();
  const completedLevels = [
    ...(progress.completedAt ? [1] : []),
    ...(contextProgress.completedAt ? [2] : []),
    ...(tokenProgress.completedAt ? [3] : []),
    ...(modelProgress.completedAt ? [4] : []),
    ...(workflowProgress.completedAt ? [5] : []),
  ];
  const currentChapter = agentLevels.findIndex(
    (_, index) => !completedLevels.includes(index + 1),
  );
  return (
    <section className="agentic-quest" aria-label="Agent 101">
      <div className="agentic-quest-heading">
        <div className="agentic-quest-title-row">
          <h2 className="agentic-quest-label">Side Quest: Agent 101</h2>
          <div
            className="agentic-quest-help"
            onMouseEnter={() => setHelpPreview(true)}
            onMouseLeave={() => setHelpPreview(false)}
            onFocus={() => setHelpPreview(true)}
            onBlur={() => {
              setHelpOpen(false);
              setHelpPreview(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setHelpOpen(false);
                setHelpPreview(false);
              }
            }}
          >
            <button
              type="button"
              className="agentic-quest-help-button"
              aria-label="What is Agent 101?"
              aria-expanded={helpOpen || helpPreview}
              aria-controls="agentic-quest-help-text"
              onClick={() => {
                setHelpOpen((open) => !open);
                setHelpPreview(false);
              }}
            >
              ?
            </button>
            <p
              id="agentic-quest-help-text"
              className="agentic-quest-help-text"
              data-open={helpOpen || helpPreview}
            >
              Agent 101 is an optional, hands-on introduction to how AI agents
              work. Complete five short chapters at your own pace to unlock Coco
              features, from inspecting tool calls to choosing models and
              reusing workflows. You can return here anytime.
            </p>
          </div>
        </div>
        <p className="agentic-quest-description">
          Discover how agents work. Unlock more of Coco as you go.
        </p>
      </div>
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
                data-coaching-control={index === 0 ? 'tool' : undefined}
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
