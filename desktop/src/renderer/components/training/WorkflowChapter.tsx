import { useState } from 'react';
import './WorkflowChapter.css';

const workflows = [
  {
    name: 'Plan, then execute',
    when: 'For tasks with several steps or changes you want to approve.',
    steps: [
      ['You', 'Set the goal'],
      ['Agent', 'Propose a plan'],
      ['You', 'Review and approve'],
      ['Agent', 'Execute and check'],
    ],
    prompt:
      'Help me reorganize my project files. Propose a plan first and wait for my approval before making changes.',
  },
  {
    name: 'Draft, then refine',
    when: 'For writing or design, when seeing a first version helps you decide.',
    steps: [
      ['You', 'Describe the result'],
      ['Agent', 'Make a first draft'],
      ['You', 'Give feedback'],
      ['Agent', 'Revise and check'],
    ],
    prompt:
      'Draft a short team update from these notes. I’ll give feedback on the tone and content before you revise it.',
  },
  {
    name: 'Explore, then choose',
    when: 'For open-ended tasks with more than one good approach.',
    steps: [
      ['You', 'Set priorities'],
      ['Agent', 'Compare options'],
      ['You', 'Choose an approach'],
      ['Agent', 'Develop the choice'],
    ],
    prompt:
      'Suggest three ways to welcome new teammates with no budget. Compare the trade-offs, then let me choose one to develop.',
  },
];

export default function WorkflowChapter() {
  const [selected, setSelected] = useState(0);
  const workflow = workflows[selected];
  return (
    <section
      className="workflow-chapter"
      aria-label="Collaborating with agents"
    >
      <p>
        A workflow notes the best practice for you and your agent to get something done.
      </p>
      <section className="workflow-lesson">
        <h3>1. Example strategies of collaborating with the agent</h3>
        <div
          className="workflow-options"
          role="group"
          aria-label="Collaboration strategies"
        >
          {workflows.map((item, index) => (
            <button
              key={item.name}
              type="button"
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          <p className="workflow-use-case">{workflow.when}</p>
          <ol className="workflow-sequence" aria-label={workflow.name}>
            {workflow.steps.map(([who, action], index) => (
              <li
                key={`${selected}-${action}`}
                className={who === 'You' ? 'workflow-human' : 'workflow-agent'}
              >
                <span>{who}</span>
                <strong>{action}</strong>
                {index < workflow.steps.length - 1 && (
                  <i aria-hidden="true">→</i>
                )}
              </li>
            ))}
          </ol>
          <blockquote>{workflow.prompt}</blockquote>
        </div>
      </section>
      <section className="workflow-lesson">
        <h3>2. Keep a workflow you like as a skill</h3>
        <p>
          A skill packages reusable instructions for an agent. Write down when
          to use your workflow, its steps, and where the agent should wait for
          you.
        </p>
        <article
          className="workflow-skill"
          aria-label="Real skill example: idea-refine"
        >
          <div className="workflow-skill-heading">
            <div>
              <span className="workflow-skill-kicker">
                REAL EXAMPLE · ADDY OSMANI
              </span>
              <h4>Idea Refine Skill</h4>
            </div>
            <a
              href="https://github.com/addyosmani/agent-skills/blob/main/skills/idea-refine/SKILL.md"
              target="_blank"
              rel="noreferrer"
            >
              Read the full skill ↗
            </a>
          </div>
          <p>
            Turns an early idea into a concrete proposal through exploration,
            evaluation, and refinement.
          </p>
          <dl className="workflow-skill-overview">
            <div>
              <dt>When to use it</dt>
              <dd>
                A vague idea or a direction whose assumptions need testing.
              </dd>
            </div>
            <div>
              <dt>What it produces</dt>
              <dd>
                A one-page proposal: the problem, chosen direction, assumptions,
                minimum scope, exclusions, and unresolved questions.
              </dd>
            </div>
          </dl>
          <details open>
            <summary>1. Clarify and explore</summary>
            <p>
              Reframe the problem, ask 3–5 focused questions, then generate 5–8
              variations. Establish the intended audience and success criteria
              before moving on.
            </p>
          </details>
          <details>
            <summary>2. Evaluate with the user</summary>
            <p>
              After the user reacts, group promising ideas into 2–3 directions.
              Assess value, feasibility, and differentiation; expose assumptions
              and possible failure points.
            </p>
          </details>
          <details>
            <summary>3. Produce a usable result</summary>
            <p>
              Write the proposal using a defined outline. Ask before saving it
              to a file.
            </p>
          </details>
          <details>
            <summary>Beyond the main instructions</summary>
            <p>
              The skill also defines tone and pitfalls, and points to companion
              files for ideation methods, evaluation criteria, and worked
              examples.
            </p>
          </details>
        </article>
        <p className="workflow-takeaway">
          For your own skill, capture the questions to ask, the checkpoints you
          want, and what a good final result should contain. Add examples or
          reference files when they help.
        </p>
      </section>
    </section>
  );
}
