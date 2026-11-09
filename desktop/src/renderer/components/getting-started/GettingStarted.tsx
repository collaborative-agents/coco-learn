/* eslint react/require-default-props: ["error", { "functions": "defaultArguments" }] */
import { useEffect, useState } from 'react';
import type { RunnerTutorialState } from '../../../shared/runner-tutorial';
import RunnerGameView from './RunnerGameView';
import CocoConnectionStatus from './CocoConnectionStatus';
import './GettingStarted.css';

/** Start the real game; all coaching comes from the separate desktop avatar. */
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
  const [complete, setComplete] = useState(false);
  const [tutorial, setTutorial] = useState<RunnerTutorialState | null>(null);
  const [starting,setStarting] = useState(false);
  useEffect(() => {
    let active = true;
    const refreshCompletion = async () => {
      try {
        const status = await window.electron?.ipcRenderer.invoke('getting-started-status');
        if (active) setComplete(status?.complete === true);
      } catch { /* Leave the task unchecked when completion cannot be read. */ }
    };
    void refreshCompletion();
    const off = window.electron?.ipcRenderer.on?.('getting-started-complete', () => void refreshCompletion());
    return () => { active = false; if (typeof off === 'function') off(); };
  }, []);
  const start = async () => {
    setStarting(true);setError('');
    try { const result=await window.electron?.ipcRenderer.invoke('runner-start'); if(result?.error)throw Error(result.error);onStart(); }
    catch(reason){setError(reason instanceof Error?reason.message:'Coco couldn’t open your game. Please try again.');}
    finally{setStarting(false);}
  };
  const act = async (action: 'play' | 'customize') => {
    if (!tutorial) return;
    try {
      setError('');
      const result = await window.electron?.ipcRenderer.invoke('runner-action', {
        sessionId: tutorial.sessionId, action,
      });
      if (result?.error) setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coco couldn’t open that step. Please try again.');
    }
  };
  useEffect(() => {
    if (view !== 'article') return;
    void window.electron?.ipcRenderer
      .invoke('runner-start')
      .then((result) => {
        if (result?.error) setError(result.error);
        if (result?.state) setTutorial(result.state);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Coco couldn’t start this activity. Please try again.'));
  }, [view]);
  if (view === 'task')
    return (
      <section className={`getting-started-task${complete ? ' is-complete' : ''}`}>
        <div>
          <span className="getting-started-kicker">GETTING STARTED</span>
          <h2>{complete ? <><span aria-hidden="true">✓ </span><s>Play with Coco</s></> : 'Play with Coco'}</h2>
          {complete && <span className="getting-started-completed" role="status">Completed</span>}
          <p className="getting-started-description" id="getting-started-description">
            Play a quick game, then ask Coco to make it your own.
            {complete ? 'Play again' : 'Start Task'} opens the game in a new window.
          </p>
        </div>
        <button
          type="button"
          className="getting-started-primary"
          aria-describedby="getting-started-description"
          disabled={starting}
          onClick={() => void start()}
        >
          {starting ? 'Opening…' : complete ? 'Play again' : 'Start Task'}
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  return (
    <section className="pixel-onboarding-page" aria-label="Play with Coco">
      <header>
        <button type="button" onClick={onBack}>
          ← Training
        </button>
        <span>Coco / Your game</span>
      </header>
      <CocoConnectionStatus />
      {error && <p role="alert">{error}</p>}
      <div className="runner-customize-entry">
        <p>Make this game your own. Tell Coco what you’d like to change.</p>
        <div>
          <button type="button" disabled={!tutorial} onClick={() => void act('play')}>Play game</button>
          <button type="button" className="getting-started-primary" disabled={!tutorial} onClick={() => void act('customize')}>Make it yours</button>
        </div>
      </div>
      <RunnerGameView embedded />
    </section>
  );
}
