import './GameIdeaCheck.css';

export default function GameIdeaCheck({ checking, interpretation }: {
  checking: boolean;
  interpretation: string | null;
}) {
  if (!checking && !interpretation) return null;
  return <section className="game-idea-check" aria-label="About Check my understanding">
    <div aria-live="polite" aria-atomic="true">
      {checking && <p role="status">Coco is reading your idea…</p>}
      {!checking && interpretation && <div className="game-idea-check-result">
        <strong>Did Coco get your idea?</strong>
        <p>{interpretation}</p>
        <p className="game-idea-check-note">Keep editing, or send your idea when you’re ready.</p>
      </div>}
    </div>
  </section>;
}
