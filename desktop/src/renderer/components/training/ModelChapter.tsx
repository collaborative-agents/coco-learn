import { useState } from 'react';
import './ToolChapter.css';
import './ModelChapter.css';

// Background: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
// https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence
// Comparisons and responses below are teaching illustrations, not benchmarks or live outputs.
const modelSizes = [
  {
    name: 'Smaller',
    x: 25,
    y: 68,
    size: 16,
    note: 'Usually faster and cheaper. Good for straightforward tasks.',
  },
  {
    name: 'Mid-sized',
    x: 53,
    y: 45,
    size: 24,
    note: 'A balance of capability, cost, and response time.',
  },
  {
    name: 'Larger',
    x: 81,
    y: 21,
    size: 34,
    note: 'Often stronger on complex tasks, but usually costs more and takes longer.',
  },
];

export default function ModelChapter() {
  const [selectedModel, setSelectedModel] = useState(1);
  return (
    <section
      className="tool-chapter model-chapter"
      aria-label="Choosing and comparing AI models"
    >
      <p className="tool-chapter-intro">
        <strong>
          The model is the engine behind an AI assistant’s responses.
        </strong>{' '}
        Switching models can change how well it handles a task, how long you
        wait, how much it costs, and the ideas it suggests.
      </p>

      <section
        className="model-lesson-card"
        aria-labelledby="model-tradeoff-title"
      >
        <h3 id="model-tradeoff-title">1. The model trade-off</h3>
        <figure className="model-tradeoff">
          <div className="model-plot-scroll">
            <div
              className="model-plot"
              role="group"
              aria-label="Explore model size, capability, cost, and response time"
            >
              <svg viewBox="0 0 600 320" aria-hidden="true">
                <path
                  className="model-plot-axis"
                  d="M85 30v235h480m-6-5 6 5-6 5M80 36l5-6 5 6"
                />
                <path
                  className="model-plot-trend"
                  d="M150 218 318 144 486 67"
                />
                <text x="330" y="309" textAnchor="middle">
                  Capability →
                </text>
                <text
                  transform="translate(24 150) rotate(-90)"
                  textAnchor="middle"
                >
                  Cost / wait time →
                </text>
                <text className="model-plot-hint" x="100" y="285">
                  Lower
                </text>
                <text
                  className="model-plot-hint"
                  x="558"
                  y="285"
                  textAnchor="end"
                >
                  Higher
                </text>
              </svg>
              <p className="model-plot-selection" aria-live="polite">
                <strong>{modelSizes[selectedModel].name}</strong>
                {modelSizes[selectedModel].note}
              </p>
              {modelSizes.map((model, index) => (
                <button
                  key={model.name}
                  type="button"
                  className="model-plot-point"
                  style={{ left: `${model.x}%`, top: `${model.y}%` }}
                  aria-pressed={selectedModel === index}
                  aria-label={`${model.name} model`}
                  onClick={() => setSelectedModel(index)}
                >
                  <span
                    className="model-plot-dot"
                    style={{ width: model.size, height: model.size }}
                  />
                  <span>{model.name}</span>
                </button>
              ))}
            </div>
          </div>
        </figure>
      </section>

      <section
        className="model-lesson-card"
        aria-labelledby="model-perspectives-title"
      >
        <h3 id="model-perspectives-title">
          2. Different models, different ideas
        </h3>
        <p>
          For open-ended questions, you can try the same prompt with different
          models.<br />For example, in brainstorming, you can try different models to
          combine their most useful ideas; in decision making, you can give them the same priorities and
          constraints and compare their assumptions and trade-offs.
        </p>
        <p className="model-note">
          Note: Check important facts. Models can agree and still be wrong.
        </p>
        <figure className="model-comparison">
          <figcaption>
            <blockquote>
              “How can new teammates get to know each other in 30 minutes, with
              no budget?”
            </blockquote>
          </figcaption>
          <div className="model-response-grid">
            <div>
              <strong>Model A</strong>
              <p>
                “Pair people up for short introductions, then rotate partners.”
              </p>
            </div>
            <div>
              <strong>Model B</strong>
              <p>“Have small groups solve a playful challenge together.”</p>
            </div>
          </div>
        </figure>
      </section>
    </section>
  );
}
