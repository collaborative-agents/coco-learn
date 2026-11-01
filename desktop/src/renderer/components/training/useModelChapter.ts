import { useEffect, useState } from 'react';
import type { ModelChapterState } from '../../../shared/model-training';

export default function useModelChapter(sessionId: string | null = null) {
  const [state, setState] = useState<ModelChapterState>({
    completedAt: null,
    session: null,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setState({ completedAt: null, session: null });
    setLoading(true);
    const refresh = async () => {
      revision += 1;
      const request = revision;
      try {
        const [progress, session] = await Promise.all([
          window.electron?.ipcRenderer.invoke('model-chapter-progress'),
          sessionId
            ? window.electron?.ipcRenderer.invoke(
                'model-chapter-session',
                sessionId,
              )
            : null,
        ]);
        if (active && request === revision) {
          setState({
            completedAt:
              typeof progress?.completedAt === 'string'
                ? progress.completedAt
                : null,
            session:
              session?.sessionId === sessionId && Array.isArray(session?.rounds)
                ? session
                : null,
          });
          setLoading(false);
        }
      } catch {
        if (active && request === revision) {
          setState({ completedAt: null, session: null });
          setLoading(false);
        }
      }
    };
    refresh();
    const offProgress = window.electron?.ipcRenderer.on?.(
      'model-chapter-progress-changed',
      refresh,
    );
    const offSession = sessionId
      ? window.electron?.ipcRenderer.on?.(
          'model-chapter-session-changed',
          refresh,
        )
      : undefined;
    return () => {
      active = false;
      offProgress?.();
      offSession?.();
    };
  }, [sessionId]);
  return {
    ...state,
    session: state.session?.sessionId === sessionId ? state.session : null,
    loading,
  };
}
