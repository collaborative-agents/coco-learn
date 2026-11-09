import { useEffect, useRef, useState } from 'react';
import type { RunnerTutorialState } from '../../../shared/runner-tutorial';
import './PixelRunner.css';
import GamePage from './GamePage';
import CocoConnectionStatus from './CocoConnectionStatus';
import TourProgress from './TourProgress';
import type { RunnerAction } from '../../../shared/runner-tutorial';

export default function RunnerGameView({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [state, setState] = useState<RunnerTutorialState | null>(null);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [meta, setMeta] = useState({title: 'Your Coco game', timeOfDay: 'night'});
  const frame = useRef<HTMLIFrameElement>(null);
  const live = useRef(state);
  live.current = state;
  const loadedVersion = useRef<string | null>(null);
  const refreshSequence = useRef(0);
  const refresh = async () => {
    const sequence = ++refreshSequence.current;
    try {
      const preview = (await window.electron?.ipcRenderer.invoke(
        'runner-preview',
      )) as { state: RunnerTutorialState; html: string; title?:string;timeOfDay?:string } | null;
      if (preview && sequence === refreshSequence.current) {
        setState(preview.state);
        setMeta({title:preview.title ?? 'Your Coco game',timeOfDay:preview.timeOfDay ?? 'night'});
        if (
          loadedVersion.current !==
          (preview.state.previewRevision ?? preview.state.version)
        ) {
          setHtml(
            embedded || (preview.state.phase === 'play' && !preview.state.introAcknowledged)
              ? preview.html.replace(
                  'globalThis.__cocoTheme=',
                  'globalThis.__cocoStartPaused=true;globalThis.__cocoTheme=',
                )
              : preview.html,
          );
          loadedVersion.current =
            preview.state.previewRevision ?? preview.state.version;
        }
        setError('');
      }
    } catch {
      setError('Your game couldn’t open. Please try again.');
    }
  };
  useEffect(() => {
    void refresh();
    const off = window.electron?.ipcRenderer.on('runner-state-changed', () => {
      void refresh();
    });
    const message = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== 'runner-game-over' ||
        !live.current ||
        live.current.previewKind === 'checking'
      )
        return;
      void window.electron?.ipcRenderer.invoke('runner-action', {
        sessionId: live.current.sessionId,
        action: 'game-over',
        score: event.data.score,
        version: event.data.version,
      });
    };
    window.addEventListener('message', message);
    return () => {
      if (typeof off === 'function') off();
      window.removeEventListener('message', message);
    };
  }, []);
  useEffect(() => {
    if (state?.introAcknowledged && state.phase === 'play')
      frame.current?.contentWindow?.postMessage({ type: 'coco-game-play' }, '*');
  }, [state?.introAcknowledged, state?.phase]);
  const act = async (action: RunnerAction | 'undo') => {
    if (!state) return;
    try {
      const result = await window.electron?.ipcRenderer.invoke(
        'runner-action',
        { sessionId: state.sessionId, action },
      );
      if (result?.error) setError(result.error);
      else { setError(''); if (result?.state) setState(result.state); }
    } catch {
      setError('That didn’t work. Your game is still safe.');
    }
  };
  const statusLabel = state?.error
    ? `Viewing ${state.hasChanges ? 'previous updated' : 'original'} game · latest change not published`
    : state?.phase === 'building'
      ? state.previewKind === 'checking' ? 'Previewing changes · checking' : 'Coco is working · previous game'
      : state?.previewKind === 'updated' ? 'Updated by Coco' : 'Original game';
  const progress = state && <TourProgress state={state} onSkip={() => void act('skip-tour')} />;
  if (state?.tour === 'meet' || state?.tour === 'done') {
    const done = state.tour === 'done';
    return <main className="coco-game-page"><section className="coco-tour-screen">
      {progress}
      <div className="coco-game-eyebrow">{done ? 'TASK COMPLETE' : 'GETTING STARTED · ABOUT 3 MINUTES'}</div>
      <h1>{done ? 'Your idea. Coco made it happen.' : 'Meet Coco.'}</h1>
      <p>{done ? 'Keep these three habits with you whenever you work with AI.' : 'Play a little game, then ask Coco to make it your own. This is your Getting Started task.'}</p>
      <div className="coco-tour-habits">
        <article><h2>{done ? 'Ask clearly' : 'Play a round'}</h2><p>{done ? 'Use your own words. Describe the details that matter and what to keep.' : 'Try jumping and ducking, then see what you would like to change.'}</p></article>
        <article><h2>{done ? 'Check the result' : 'Make it yours'}</h2><p>{done ? 'Check Coco’s understanding, then play and see whether the result matches your idea.' : 'Tell Coco how you want your game to look or play.'}</p></article>
        <article><h2>{done ? 'Let Coco do the work' : 'Watch Coco do it'}</h2><p>{done ? 'Coco edits and tests the game. You decide whether it’s ready.' : 'See an agent make and test a working change, beyond giving advice.'}</p></article>
      </div>
      {!done && <CocoConnectionStatus onReady={setConnected} />}
      {error && <p role="alert">{error}</p>}
      <div className="coco-tour-buttons">
        <button className="coco-button coco-button--primary" disabled={!done && !connected} onClick={() => void act(done ? 'finish-setup' : 'tour-play')}>{done ? 'Finish task' : 'Let’s play'}</button>
      </div>
      {!done && <p>You’re using your signed-in Coco account. If the connection isn’t ready, retry above or leave the task for now.</p>}
    </section></main>;
  }
  return <GamePage {...meta} html={html} frameRef={frame}
    progress={progress} canCustomize={Boolean(state?.firstGameOver || state?.hasChanges || state?.tour !== 'active')}
    inviteCustomize={Boolean(state?.firstGameOver && state?.phase === 'play')}
    updated={Boolean(state?.hasChanges && state.previewKind === 'updated' && !state.error)}
    completed={state?.phase === 'complete'}
    busy={!state || state.phase === 'building'} canUndo={state?.canUndo} failed={Boolean(state?.error)}
    statusLabel={statusLabel} onAction={action => void act(action)}
    notice={<><CocoConnectionStatus quiet />{(error || state?.error || state?.previewError) &&
      <div className="coco-game-error" role="status"><p>{state?.error || state?.previewError || error}</p>
      <button className="coco-button coco-button--primary" type="button" onClick={() => state?.error ? void act('retry') : void refresh()}>Try again</button></div>}</>} />;
}
