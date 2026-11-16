/* eslint react/require-default-props: ["error", { "functions": "defaultArguments" }] */
import { useCallback, useEffect, useRef, useState } from 'react';
import './GettingStarted.css';

/** The task entry opens the guided game conversation in Chat. */
export default function GettingStarted({
  view = 'task',
  onBack = () => {},
  onStart = () => {},
}: {
  view?: 'task' | 'article';
  onBack?: () => void;
  onStart?: () => void;
}) {
  const [error, setError] = useState('');
  const [, setComplete] = useState(false);
  const [starting, setStarting] = useState(false);
  const openedFromBubble = useRef(false);
  useEffect(() => {
    let active = true;
    const refreshCompletion = async () => {
      try {
        const status = await window.electron?.ipcRenderer.invoke(
          'getting-started-status',
        );
        if (active) setComplete(status?.complete === true);
      } catch {
        /* Leave the task unchecked when completion cannot be read. */
      }
    };
    void refreshCompletion();
    const off = window.electron?.ipcRenderer.on?.(
      'getting-started-complete',
      () => void refreshCompletion(),
    );
    return () => {
      active = false;
      if (typeof off === 'function') off();
    };
  }, []);
  const start = useCallback(async () => {
    setStarting(true);
    setError('');
    try {
      const result = await window.electron?.ipcRenderer.invoke('runner-start');
      if (result?.error) throw Error(result.error);
      onStart();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Coco couldn’t open your game. Please try again.',
      );
    } finally {
      setStarting(false);
    }
  }, [onStart]);
  useEffect(() => {
    if (view !== 'article') {
      openedFromBubble.current = false;
    } else if (!openedFromBubble.current) {
      openedFromBubble.current = true;
      void start();
    }
  }, [view, start]);
  if (view === 'task' && !error && !starting) return null;
  return (
    <section className="getting-started-entry" aria-label="Getting Started">
      {view === 'article' && (
        <button type="button" onClick={onBack}>
          ← Training tasks
        </button>
      )}
      {error && <button
        type="button"
        className="getting-started-primary"
        disabled={starting}
        onClick={() => void start()}
      >
        {starting ? 'Opening…' : 'Try again'}
      </button>}
      {starting && <p role="status">Opening…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
