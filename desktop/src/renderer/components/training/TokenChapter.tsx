import './ToolChapter.css';
import './TokenChapter.css';

// Illustrative segmentation, not the output of a specific model's tokenizer.
const textTokens = ['AI', ' is', ' help', 'ful', '.'];
const patches = Array.from({ length: 16 }, (_, index) => index);

function Landscape() {
  return (
    <>
      <path fill="#c7e8f5" d="M0 0h240v240H0z" />
      <circle fill="#ffd36e" cx="178" cy="58" r="27" />
      <path fill="#749b88" d="m0 170 80-110 100 120 60-65v125H0z" />
      <path fill="#edf3ed" d="m51 100 29-40 34 41-22-10-15 10-12-10z" />
      <path fill="#426e62" d="M0 188q70-58 135 0t105-10v62H0z" />
      <path
        fill="#8dc5dc"
        d="M120 184q-50 20-10 31t-15 25h65q40-23-10-32t-8-24z"
      />
    </>
  );
}

export default function TokenChapter() {
  return (
    <section
      className="tool-chapter token-chapter"
      aria-label="Understanding tokens"
    >
      <p className="tool-chapter-intro">
        <strong>
          A token is a small unit of information an AI model processes.
        </strong>{' '}
        Tokens are also a common billing unit for today’s AI models. Both what a
        model reads and what it generates count toward usage. Be mindful!
      </p>

      <section className="token-lesson-card" aria-labelledby="token-text-title">
        <h3 id="token-text-title">1. A sentence becomes tokens</h3>
        <p>A token can be a whole word, part of a word, or punctuation.</p>
        <figure className="token-text-example">
          <div className="token-flow">
            <div className="token-flow-source">
              <span className="token-flow-label">Sentence</span>
              <blockquote>AI is helpful.</blockquote>
            </div>
            <span className="token-flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="token-flow-result">
              <span className="token-flow-label">Tokens</span>
              <div
                className="token-pieces"
                aria-label="Five illustrative tokens: AI, space is, space help, ful, period"
              >
                {textTokens.map((token, index) => (
                  <code
                    key={token}
                    style={{ animationDelay: `${index * 140}ms` }}
                  >
                    {token.replace(' ', '␣')}
                  </code>
                ))}
              </div>
            </div>
          </div>
          <figcaption>
            3 words → 5 tokens in this illustration. ␣ marks a space.
          </figcaption>
        </figure>
      </section>

      <section
        className="token-lesson-card"
        aria-labelledby="token-image-title"
      >
        <h3 id="token-image-title">2. Images can become tokens, too</h3>
        <p>
          A common approach divides an image into small patches. A vision
          encoder turns those patches into numerical representations the model
          can process as visual tokens.
        </p>
        <figure className="token-image-example">
          <div className="token-flow token-flow-image">
            <div className="token-flow-source">
              <span className="token-flow-label">Image</span>
              <svg
                viewBox="0 0 240 240"
                role="img"
                aria-label="Mountain landscape with a sun and river"
              >
                <Landscape />
              </svg>
            </div>
            <span className="token-flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="token-flow-result">
              <span className="token-flow-label">
                Visual tokens · illustrated as patches
              </span>
              <div
                className="token-patch-sequence"
                aria-label="16 image patches in order from left to right, row by row"
              >
                {patches.map((patch) => (
                  <div
                    key={patch}
                    style={{ animationDelay: `${patch * 100}ms` }}
                  >
                    <svg
                      viewBox={`${(patch % 4) * 60} ${Math.floor(patch / 4) * 60} 60 60`}
                      aria-hidden="true"
                    >
                      <Landscape />
                    </svg>
                    <span>{patch + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <figcaption>
            Image → 16 patches → a sequence of visual representations.
          </figcaption>
        </figure>
        <p className="token-note">
          This 4 × 4 grid illustrates the idea; it is not a bill of 16 tokens.
          Actual image token counts depend on the model, image size, and detail
          settings. Models may resize images or combine patches, and billed
          tokens may differ from the patch count.
        </p>
      </section>
    </section>
  );
}
