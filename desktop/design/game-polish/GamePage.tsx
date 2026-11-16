import type { ReactNode } from 'react';
import './GamePage.css';

type Action = 'undo' | 'customize' | 'finish';

/** Presentation only. The real session controller will be connected after review. */
export default function GamePage({
  title,
  timeOfDay,
  html,
  updated = false,
  companion,
  onAction,
}: {
  title: string;
  timeOfDay: string;
  html: string;
  updated?: boolean;
  companion?: ReactNode;
  onAction?: (action: Action) => void;
}) {
  return (
    <main className="coco-game-page">
      <div className="coco-game-content">
        <header className="coco-game-heading">
          <div>
            <div className="coco-game-eyebrow">GETTING STARTED</div>
            <h1>Play with Coco</h1>
          </div>
          <span className={`coco-game-version${updated ? ' is-updated' : ''}`}>
            <span aria-hidden="true">{updated ? '✓' : '◌'}</span>
            {updated ? 'Updated game' : 'Original game'}
          </span>
        </header>

        <section className="coco-game-card" aria-label={title}>
          <div className="coco-game-card-heading">
            <div className="coco-game-world">
              <span className="coco-game-world-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none"><path d="m12 3 6 8h-3l5 7H4l5-7H6l6-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 18v3" stroke="currentColor" strokeWidth="1.5"/></svg>
              </span>
              <span>{title}</span>
            </div>
            <span className="coco-game-setting">
              <span aria-hidden="true">{timeOfDay === 'night' ? '☾' : '☀'}</span>
              {timeOfDay === 'day' ? 'Daylight' : timeOfDay[0].toUpperCase() + timeOfDay.slice(1)}
            </span>
          </div>
          <div className="coco-game-frame">
            <iframe title="Your playable game" sandbox="allow-scripts" srcDoc={html} />
          </div>
          <footer className="coco-game-actions">
            <button type="button" className="coco-button coco-game-undo" disabled={!updated} onClick={() => onAction?.('undo')}>
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5 3 9l4 4M3 9h8a5 5 0 0 1 0 10" transform="translate(1 -2)" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Undo change
            </button>
            <div className="coco-game-next-actions">
              <button type="button" className={`coco-button${updated ? '' : ' coco-button--primary'}`} onClick={() => onAction?.('customize')}>
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 15 8-8 3 3-8 8H4v-3ZM11 4V1M17 7h3M17 3l2-2M4 8H1M7 4V1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Make it yours
              </button>
              {updated && <button type="button" className="coco-button coco-button--primary" onClick={() => onAction?.('finish')}>
                Looks good <span aria-hidden="true">✓</span>
              </button>}
            </div>
          </footer>
        </section>
        {companion && <aside className="coco-game-companion" aria-label="Coco's guidance">{companion}</aside>}
      </div>
    </main>
  );
}
