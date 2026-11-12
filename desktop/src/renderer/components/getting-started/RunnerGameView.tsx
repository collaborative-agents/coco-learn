import { useEffect, useRef, useState } from 'react';
import type { RunnerTutorialState } from '../../../shared/runner-tutorial';
import './PixelRunner.css';
import GamePage from './GamePage';
import './OnboardingConversation.css';
import type { RunnerAction } from '../../../shared/runner-tutorial';

export default function RunnerGameView({
  embedded = false,
  visible = true,
}: {
  embedded?: boolean;
  visible?: boolean;
}) {
  const [state, setState] = useState<RunnerTutorialState | null>(null);
  const [html, setHtml] = useState('');
  const [gameLoaded, setGameLoaded] = useState(false);
  const [error, setError] = useState('');
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
          `${preview.state.previewRevision ?? preview.state.version}:${Boolean(preview.state.introAcknowledged)}`
        ) {
          setHtml(
            preview.state.phase === 'play' && !preview.state.introAcknowledged
              ? preview.html.replace(
                  'globalThis.__cocoTheme=',
                  'globalThis.__cocoStartPaused=true;globalThis.__cocoTheme=',
                )
              : preview.html,
          );
          loadedVersion.current =
            `${preview.state.previewRevision ?? preview.state.version}:${Boolean(preview.state.introAcknowledged)}`;
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
  useEffect(() => {
    if (!embedded || !visible || !gameLoaded || state?.tour !== 'active' || state?.phase !== 'play') return undefined;
    const timer = setTimeout(() => {
      void window.electron?.ipcRenderer.invoke('runner-action', {
        sessionId: state.sessionId, action: 'game-suggestion',
      });
    }, 10_000);
    return () => clearTimeout(timer);
  }, [embedded, visible, gameLoaded, state?.sessionId, state?.tour, state?.phase]);
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
  if (state?.tour === 'meet') return null;
  if (embedded) return (
    <div className="onboarding-game-preview" aria-label="Your game preview">
      {html ? <iframe ref={frame} title="Your playable game" sandbox="allow-scripts" srcDoc={html} onLoad={() => setGameLoaded(true)} /> : <p role="status">Opening your game…</p>}
      {state?.phase === 'building' && <p role="status">I’m working on your change. You can keep playing while I finish.</p>}
      {(error || state?.error || state?.previewError) && <p role="alert">{error || state?.error || state?.previewError} <button type="button" onClick={() => state?.error ? void act('retry') : void refresh()}>Try again</button></p>}
      <div className="onboarding-replies">
        {state?.canUndo && <button type="button" disabled={state.phase === 'building'} onClick={() => void act('undo')}>Undo change</button>}
      </div>
    </div>
  );
  return <GamePage {...meta} html={html} frameRef={frame}
    canCustomize={Boolean(state?.firstGameOver || state?.hasChanges || state?.tour !== 'active')}
    inviteCustomize={Boolean(state?.firstGameOver && state?.phase === 'play')}
    updated={Boolean(state?.hasChanges && state.previewKind === 'updated' && !state.error)}
    completed={state?.phase === 'complete'}
    busy={!state || state.phase === 'building'} canUndo={state?.canUndo} failed={Boolean(state?.error)}
    statusLabel={statusLabel} onAction={action => void act(action)}
    notice={<>{(error || state?.error || state?.previewError) &&
      <div className="coco-game-error" role="status"><p>{state?.error || state?.previewError || error}</p>
      <button className="coco-button coco-button--primary" type="button" onClick={() => state?.error ? void act('retry') : void refresh()}>Try again</button></div>}</>} />;
}
