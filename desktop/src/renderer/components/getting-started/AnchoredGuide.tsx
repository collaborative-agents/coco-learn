import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { RunnerGuide } from '../../../shared/runner-tutorial';
import './AnchoredGuide.css';

type Bounds = { left: number; top: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export default function AnchoredGuide({
  guide,
  bounds,
}: {
  guide: RunnerGuide;
  bounds: Bounds;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    left: 16,
    top: 16,
    side: 'left',
    arrow: 32,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = guide.instructionId ?? guide.learningStep;

  useLayoutEffect(() => {
    const measure = () => {
      if (!card.current) return;
      const { width, height } = card.current.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      let left = bounds.left + bounds.width + 24;
      let top = centerY - height / 2;
      let side = 'left';
      if (left + width > window.innerWidth - 16) {
        if (bounds.left - width - 24 >= 16) {
          left = bounds.left - width - 24;
          side = 'right';
        } else {
          left = centerX - width / 2;
          top = bounds.top + bounds.height + 24;
          side = 'top';
          if (top + height > window.innerHeight - 16) {
            top = bounds.top - height - 24;
            side = 'bottom';
          }
        }
      }
      left = clamp(left, 16, window.innerWidth - width - 16);
      top = clamp(top, 16, window.innerHeight - height - 16);
      const arrow =
        side === 'left' || side === 'right'
          ? clamp(centerY - top, 20, height - 20)
          : clamp(centerX - left, 20, width - 20);
      setPosition({ left, top, side, arrow });
    };
    measure();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(measure);
    if (card.current) observer?.observe(card.current);
    return () => observer?.disconnect();
  }, [bounds, guide.text]);

  useEffect(() => {
    setBusy(false);
    setError('');
  }, [key]);

  const act = async (action: RunnerGuide['action']) => {
    setBusy(true);
    setError('');
    try {
      const result = (await window.electron?.ipcRenderer.invoke(
        'runner-action',
        { sessionId: guide.sessionId, action },
      )) as { error?: string } | undefined;
      if (result?.error) setError(result.error);
    } catch {
      setError('Could not continue. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={card}
      className={`observation-bubble is-guide status-${guide.status ?? 'observing'} coco-anchored-guide points-${position.side}`}
      role="region"
      aria-label={guide.label}
      style={
        {
          left: position.left,
          top: position.top,
          '--guide-arrow': `${position.arrow}px`,
        } as CSSProperties
      }
    >
      <span
        className="observation-bubble-tail coco-anchored-guide-pointer"
        aria-hidden="true"
      />
      <div className="coco-anchored-guide-content">
        <div className="observation-bubble-header">
          <div className="observation-bubble-label">{guide.label}</div>
          <button
            type="button"
            className="bubble-dismiss-btn"
            aria-label="Close tip"
            disabled={busy}
            onClick={() => void act('dismiss')}
          >
            ×
          </button>
        </div>
        <div className="observation-bubble-text" aria-live="polite">
          {guide.text}
        </div>
        {guide.action && (
          <button
            type="button"
            className="bubble-action-btn"
            disabled={busy}
            onClick={() => void act(guide.action)}
          >
            {busy ? 'Opening…' : guide.actionLabel}
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
