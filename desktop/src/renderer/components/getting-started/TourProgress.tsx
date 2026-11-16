import type { RunnerTutorialState } from '../../../shared/runner-tutorial';
import './TourProgress.css';

export default function TourProgress({ state, onSkip }: { state: RunnerTutorialState; onSkip: () => void }) {
  if (!state.tour || ['finished', 'skipped'].includes(state.tour)) return null;
  const step = state.tour === 'meet' ? 0 : state.tour === 'done' ? 3 : state.phase === 'play' ? 1 : 2;
  return <nav className="coco-tour-progress" aria-label="Getting Started progress">
    <ol>{['Meet Coco', 'Play', 'Make it yours', 'Done'].map((label, index) =>
      <li key={label} aria-current={index === step ? 'step' : undefined} className={index < step ? 'is-done' : ''}>
        <span>{index < step ? '✓' : index + 1}</span>{label}
      </li>)}</ol>
    <button type="button" className="coco-tour-skip" onClick={onSkip}>Leave task</button>
  </nav>;
}
