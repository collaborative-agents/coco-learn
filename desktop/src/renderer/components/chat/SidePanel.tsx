import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import SessionRecapView, { type DockedRecap } from '../SessionRecapView';
import { embedCocoMascot } from './html-preview';
import './SidePanel.css';

/** Content Coco can show beside the chat, in a split-screen pane. */
export type SidePanelContent =
  | { kind: 'game' }
  | { kind: 'html'; html: string }
  | { kind: 'check'; recap: DockedRecap };

/** Opens content in the side pane; null when no pane host is mounted. */
export const SidePanelContext = createContext<((content: SidePanelContent) => void) | null>(null);

const TITLES: Record<SidePanelContent['kind'], string> = {
  game: 'Your game',
  html: 'HTML preview',
  check: 'Check your understanding',
};

function HtmlPane({ html }: { html: string }) {
  const [mascot, setMascot] = useState<string | null>(null);
  useEffect(() => {
    void window.electron?.ipcRenderer.invoke('get-coco-mascot-data-url')
      .then((data: unknown) => setMascot(typeof data === 'string' ? data : null))
      .catch(() => {});
  }, []);
  // Same isolation as the standalone preview window: no scripts, no same-origin.
  return <iframe className="side-panel-frame" title="HTML page preview" sandbox="" srcDoc={embedCocoMascot(html, mascot)} />;
}

export default function SidePanel({
  content,
  game,
  width,
  onResize,
  onClose,
}: {
  content: SidePanelContent;
  game: ReactNode;
  width: number;
  onResize: (fraction: number) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState('');
  const pane = useRef<HTMLElement>(null);
  useEffect(() => setStatus(''), [content]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const host = pane.current?.parentElement;
    if (!host) return;
    event.preventDefault();
    const bounds = host.getBoundingClientRect();
    const move = (moveEvent: PointerEvent) => {
      const fraction = (bounds.right - moveEvent.clientX) / bounds.width;
      onResize(Math.min(0.7, Math.max(0.3, fraction)));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const save = async () => {
    if (content.kind !== 'html') return;
    const result = await window.electron?.ipcRenderer.invoke('save-html-preview', { html: content.html });
    if (result?.success) setStatus('Saved');
    else if (!result?.canceled) setStatus(result?.error || 'Could not save the page');
  };

  return (
    <>
      <div
        className="side-panel-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize side panel"
        onPointerDown={startResize}
      />
      <aside ref={pane} className="side-panel" aria-label={TITLES[content.kind]} style={{ flexBasis: `${width * 100}%` }}>
        <header className="side-panel-header">
          <span className="side-panel-title">{TITLES[content.kind]}</span>
          <div className="side-panel-actions">
            {status && <span role="status">{status}</span>}
            {content.kind === 'html' && <button type="button" onClick={() => void save()}>Save HTML</button>}
            <button type="button" className="side-panel-close" aria-label="Close side panel" title="Close" onClick={onClose}>×</button>
          </div>
        </header>
        <div className="side-panel-body">
          {content.kind === 'game' && game}
          {content.kind === 'html' && <HtmlPane html={content.html} />}
          {content.kind === 'check' && <SessionRecapView docked={content.recap} onDone={onClose} />}
        </div>
      </aside>
    </>
  );
}
