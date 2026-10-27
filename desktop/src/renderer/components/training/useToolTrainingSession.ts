import { useEffect, useState } from 'react';
import type { ToolTrainingSession } from '../../../shared/tool-exploration';

export default function useToolTrainingSession(sessionId: string | null) {
  const [session, setSession] = useState<ToolTrainingSession | null>(null);
  useEffect(() => {
    let active = true;
    setSession(null);
    if (sessionId)
      window.electron.ipcRenderer
        .invoke('tool-chapter-session', sessionId)
        .then((value) => {
          if (active) setSession(value);
          return undefined;
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [sessionId]);
  return session?.sessionId === sessionId ? session : null;
}
