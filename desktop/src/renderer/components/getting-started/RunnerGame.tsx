import { useEffect, useRef, useState } from 'react';
import { pixelConfig } from './pixel/config';
import { advanceRun, createRun, jump } from './pixel/behavior';
import { renderRun } from './pixel/render';
import './PixelRunner.css';

const bestKey = 'coco-pixel-runner-best-v1';
export default function RunnerGame({
  onGameOver = () => {},
  initiallyPaused = false,
}: {
  onGameOver?: (score: number) => void;
  initiallyPaused?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [over, setOver] = useState(false);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(
    () =>
      initiallyPaused || (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  );
  const [score, setScore] = useState(0);
  const state = useRef(createRun(pixelConfig));
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const onOver = useRef(onGameOver);
  onOver.current = onGameOver;
  const audio = useRef<AudioContext | null>(null);
  const action = useRef<() => void>(() => {});
  const tone = (hit = false) => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext();
      const ac = audio.current;
      void ac.resume();
      const osc = ac.createOscillator(),
        gain = ac.createGain();
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.frequency.setValueAtTime(hit ? 150 : 420, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        hit ? 50 : 690,
        ac.currentTime + 0.11,
      );
      gain.gain.setValueAtTime(0.018, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.14);
      osc.start();
      osc.stop(ac.currentTime + 0.15);
    } catch {
      /* The game remains playable if audio is unavailable. */
    }
  };
  action.current = () => {
    if (state.current.gameOver) {
      if (state.current.time - state.current.hitAt < 0.3) return;
      state.current = createRun(
        pixelConfig,
        state.current.highScore,
        Date.now() >>> 0,
      );
      setOver(false);
      setScore(0);
      setPaused(false);
    } else if (pausedRef.current) setPaused(false);
    else if (jump(state.current, pixelConfig)) tone();
  };
  useEffect(() => {
    try {
      const best = Number(localStorage.getItem(bestKey));
      if (Number.isFinite(best) && best > 0)
        state.current.highScore = Math.floor(best);
    } catch {
      /* A best score is optional. */
    }
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return undefined;
    let id = 0,
      previous = 0,
      lastScore = -1;
    const tick = (time: number) => {
      const elapsed = previous ? (time - previous) / 1000 : 0;
      previous = time;
      if (!pausedRef.current && !document.hidden) {
        const collided = advanceRun(state.current, pixelConfig, elapsed);
        if (collided) {
          setOver(true);
          tone(true);
          onOver.current(state.current.score);
          try {
            localStorage.setItem(bestKey, String(state.current.highScore));
          } catch {
            /* Optional. */
          }
        }
      }
      if (state.current.score !== lastScore && state.current.score % 10 === 0) {
        lastScore = state.current.score;
        setScore(lastScore);
      }
      renderRun(ctx, state.current, pixelConfig, pausedRef.current);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      if (target?.closest('button') && !target.closest('.pixel-canvas')) return;
      if (event.code === 'Space' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!event.repeat) action.current();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.current.ducking = true;
      }
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') state.current.ducking = false;
    };
    const blur = () => {
      state.current.ducking = false;
      setPaused(true);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      void audio.current?.close();
    };
  }, []);
  return (
    <div className="pixel-runner">
      <canvas
        ref={canvas}
        width={pixelConfig.width}
        height={pixelConfig.height}
        className="pixel-canvas"
        tabIndex={0}
        role="button"
        aria-label={
          over
            ? 'Game over. Press Space or tap to restart.'
            : 'Moonlit Run. Space or Up jumps. Hold Down to duck.'
        }
        onPointerDown={(event) => {
          event.currentTarget.focus();
          action.current();
        }}
      >
        Moonlit Run: Space or Up to jump, Down to duck. Tap to jump or restart.
      </canvas>
      <div className="pixel-controls">
        <div className="pixel-touch-controls">
          <button type="button" onClick={() => action.current()}>
            {' '}
            {over ? 'Play again' : 'Jump'} <kbd>↑</kbd>
          </button>
          <button
            type="button"
            aria-label="Hold to duck"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              state.current.ducking = true;
            }}
            onPointerUp={() => {
              state.current.ducking = false;
            }}
            onPointerCancel={() => {
              state.current.ducking = false;
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                state.current.ducking = true;
              }
            }}
            onKeyUp={() => {
              state.current.ducking = false;
            }}
          >
            Duck <kbd>↓</kbd>
          </button>
        </div>
        <span className="pixel-score-reader" role="status">
          {over
            ? `Round finished. Score ${state.current.score}. Best ${state.current.highScore}.`
            : `Score ${score}`}
        </span>
        <div className="pixel-utility-controls">
          <button
            type="button"
            aria-pressed={sound}
            onClick={() => setSound((value) => !value)}
          >
            Sound {sound ? 'on' : 'off'}
          </button>
          <button type="button" onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
    </div>
  );
}
