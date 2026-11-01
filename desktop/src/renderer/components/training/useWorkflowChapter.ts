import { useEffect, useState } from 'react';
import type { WorkflowState } from '../../../shared/workflow-training';

export default function useWorkflowChapter(sessionId: string | null = null) {
  const [state, setState] = useState<WorkflowState>({
    completedAt: null,
    session: null,
    skills: [],
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let revision = 0;
    setState({ completedAt: null, session: null, skills: [] });
    setLoading(true);
    const refresh = async () => {
      revision += 1;
      const request = revision;
      try {
        const [progress, session] = await Promise.all([
          window.electron?.ipcRenderer.invoke('workflow-chapter-progress'),
          sessionId
            ? window.electron?.ipcRenderer.invoke(
                'workflow-chapter-session',
                sessionId,
              )
            : null,
        ]);
        if (active && request === revision) {
          setState({
            skills: [],
            completedAt:
              typeof progress?.completedAt === 'string'
                ? progress.completedAt
                : null,
            session:
              session?.sessionId === sessionId && Array.isArray(session?.trials)
                ? session
                : null,
          });
          setLoading(false);
        }
      } catch {
        if (active && request === revision) {
          setState({ completedAt: null, session: null, skills: [] });
          setLoading(false);
        }
      }
    };
    refresh();
    const offProgress = window.electron?.ipcRenderer.on?.(
      'workflow-chapter-progress-changed',
      refresh,
    );
    return () => {
      active = false;
      offProgress?.();
    };
  }, [sessionId]);
  return {
    ...state,
    session: state.session?.sessionId === sessionId ? state.session : null,
    loading,
  };
}
