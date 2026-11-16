import { useEffect, useState } from 'react';
import { embedCocoMascot, extractPreviewHtml } from './chat/html-preview';
import './HtmlPreviewView.css';

export default function HtmlPreviewView() {
  const [html, setHtml] = useState('');
  const [mascot, setMascot] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const cleanup = window.electron?.ipcRenderer.on('html-preview', (payload: unknown) => {
      const source = (payload as { html?: unknown } | null)?.html;
      if (typeof source === 'string') setHtml(extractPreviewHtml(source) ?? '');
    });
    void window.electron?.ipcRenderer.invoke('get-coco-mascot-data-url')
      .then((data: unknown) => setMascot(typeof data === 'string' ? data : null))
      .catch(() => {});
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.electron?.ipcRenderer.sendMessage('close-html-preview');
    };
    window.addEventListener('keydown', onKeyDown);
    window.electron?.ipcRenderer.sendMessage('html-preview-ready');
    return () => {
      if (typeof cleanup === 'function') cleanup();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const finalHtml = embedCocoMascot(html, mascot);
  const save = async () => {
    const result = await window.electron?.ipcRenderer.invoke('save-html-preview', { html: finalHtml });
    if (result?.success) setStatus('Saved HTML page');
    else if (!result?.canceled) setStatus(result?.error || 'Could not save the page');
  };

  return (
    <div className="html-preview-window">
      <header className="html-preview-toolbar">
        <div className="html-preview-brand">
          {mascot && <img src={mascot} alt="Coco" />}
          <span><strong>Coco</strong> · HTML Preview</span>
        </div>
        <div className="html-preview-actions">
          {status && <span role="status">{status}</span>}
          <button type="button" onClick={() => void save()} disabled={!html}>Save HTML</button>
          <button type="button" aria-label="Close HTML preview" onClick={() => window.electron?.ipcRenderer.sendMessage('close-html-preview')}>×</button>
        </div>
      </header>
      {html ? (
        <iframe title="HTML page preview" sandbox="" srcDoc={finalHtml} />
      ) : <div className="html-preview-empty">Preparing preview…</div>}
    </div>
  );
}
