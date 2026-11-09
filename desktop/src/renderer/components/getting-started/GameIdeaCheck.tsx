import './GameIdeaCheck.css';

export default function GameIdeaCheck({ checking, interpretation }: {
  checking: boolean;
  interpretation: string | null;
}) {
  return <section className="game-idea-check" aria-label="About Check my understanding">
    <p><strong>Check before you send.</strong> Check my understanding asks Coco to
      repeat your game idea back so you can see whether it understood you.</p>
    <p className="game-idea-check-note">Your draft stays here. Use Send when you’re ready to make the change.</p>
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
