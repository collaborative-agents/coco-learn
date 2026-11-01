import { useEffect, useState } from 'react';
import type { TokenTrainingSession } from '../../../shared/token-training';

export default function useTokenChapter(sessionId: string | null = null) {
  const [state, setState] = useState<{
    completedAt: string | null;
    session: TokenTrainingSession | null;
  }>({ completedAt: null, session: null });
  useEffect(() => {
    let active = true;
    let revision = 0;
    setState({ completedAt: null, session: null });
    const refresh = async () => {
      revision += 1;
      const request = revision;
      try {
        const [progress, session] = await Promise.all([
          window.electron?.ipcRenderer.invoke('token-chapter-progress'),
          sessionId
            ? window.electron?.ipcRenderer.invoke(
                'token-chapter-session',
                sessionId,
              )
            : null,
        ]);
        if (active && request === revision)
          setState({
            completedAt:
              typeof progress?.completedAt === 'string'
                ? progress.completedAt
                : null,
            session:
              session?.sessionId === sessionId &&
              Array.isArray(session?.requests)
                ? session
                : null,
          });
      } catch {
        if (active && request === revision)
          setState({ completedAt: null, session: null });
      }
    };
    refresh();
    const unsubscribe = window.electron?.ipcRenderer.on?.(
      'token-chapter-progress-changed',
      refresh,
    );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [sessionId]);
  return {
    ...state,
    session: state.session?.sessionId === sessionId ? state.session : null,
  };
}
