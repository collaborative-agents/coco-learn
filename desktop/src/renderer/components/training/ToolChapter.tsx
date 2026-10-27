import { useId, useState } from 'react';
import './ToolChapter.css';

const moments = [
  {
    name: 'You',
    title: 'Start with a question',
    text: '“How many unfinished tasks are in my notes?” Coco needs to read the file to find out.',
  },
  {
    name: 'Coco',
    title: 'Coco requests an action',
    text: 'Coco asks a tool to read the notes and count unfinished tasks. The app runs that action.',
  },
  {
    name: 'Bash tool',
    title: 'The tool returns a result',
    text: 'Bash runs written commands. It can combine programs to read files, count tasks, or create a chart.',
  },
  {
    name: 'Answer',
    title: 'Coco uses the result',
    text: 'The tool returns “2.” Coco answers: “You have 2 unfinished tasks.” It can request another tool action if needed.',
  },
];

export default function ToolChapter() {
  const [selected, setSelected] = useState(0);
  const arrowId = useId();
  return (
    <section className="tool-chapter" aria-label="How Coco uses a tool">
      <p className="tool-chapter-intro">
        A <strong>tool</strong> lets an AI agent do something beyond writing a
        reply, like read a file, search, or run a command.
      </p>
      <p className="tool-chapter-intro">
        Many modern AI agents are equipped with <strong>Bash tools</strong>,
        which let them use a computer by typing commands, with the access they
        have been given. An agent can work with files, run programs, and connect
        small actions into bigger tasks. This puts powerful tools in your hands.
        Stay in control by checking what the AI does on your computer.
      </p>
      <div className="tool-diagram-scroll">
        <div className={`tool-diagram tool-diagram--step-${selected}`}>
          <div className="tool-diagram-note">
            <div
              className="tool-diagram-caption"
              aria-live="polite"
              aria-atomic="true"
            >
              <strong>{moments[selected].title}</strong>
              <p>{moments[selected].text}</p>
            </div>
            <div
              className="tool-diagram-controls"
              role="group"
              aria-label="Explore the tool loop"
            >
              {moments.map((moment, index) => (
                <button
                  key={moment.name}
                  type="button"
                  aria-label={`${index + 1}. ${moment.name}`}
                  title={moment.name}
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
          <svg viewBox="0 0 640 330" aria-hidden="true">
            <defs>
              <marker
                id={arrowId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M1 1 9 5 1 9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </marker>
            </defs>
            <rect
              className="tool-diagram-boundary"
              x="35"
              y="150"
              width="365"
              height="165"
              rx="20"
            />
            <g fill="none" markerEnd={`url(#${arrowId})`}>
              <path
                className={`tool-diagram-path${selected === 0 ? ' is-active' : ''}`}
                d="M160 200H260"
              />
              <path
                className={`tool-diagram-path${selected === 1 ? ' is-active' : ''}`}
                d="M320 175V105Q320 85 340 85H410"
              />
              <path
                className={`tool-diagram-path${selected === 2 ? ' is-active' : ''}`}
                d="M480 120V220Q480 240 460 240H380"
              />
              <path
                className={`tool-diagram-path${selected === 3 ? ' is-active' : ''}`}
                d="M290 235V265Q290 280 270 280H130Q110 280 110 260V235"
              />
            </g>
            <text x="205" y="184" textAnchor="middle">
              question
            </text>
            <text x="360" y="65" textAnchor="middle">
              tool call
            </text>
            <text x="492" y="183">
              result
            </text>
            <text x="206" y="266" textAnchor="middle">
              answer
            </text>
            <text x="370" y="302" textAnchor="end">
              your conversation
            </text>
          </svg>
          <button
            type="button"
            className="tool-diagram-node tool-diagram-user"
            aria-pressed={selected === 0}
            onClick={() => setSelected(0)}
          >
            You
          </button>
          <button
            type="button"
            className="tool-diagram-node tool-diagram-coco"
            aria-pressed={selected === 1 || selected === 3}
            onClick={() => setSelected(1)}
          >
            Coco<span>chooses the action</span>
          </button>
          <button
            type="button"
            className="tool-diagram-node tool-diagram-bash"
            aria-pressed={selected === 2}
            onClick={() => setSelected(2)}
          >
            <span className="tool-diagram-terminal" aria-hidden="true">
              &gt;_
            </span>
            Bash tool<span>runs commands</span>
          </button>
        </div>
      </div>
    </section>
  );
}
