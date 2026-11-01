import { useEffect, useState } from 'react';
import {
  emptyContextProgress,
  type ContextChapterProgress,
} from '../../../shared/context-training';

export default function useContextChapterProgress() {
  const [progress, setProgress] =
    useState<ContextChapterProgress>(emptyContextProgress);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      revision += 1;
      const requestedRevision = revision;
      Promise.resolve(
        window.electron?.ipcRenderer.invoke('context-chapter-progress'),
      )
        .then((value) => {
          if (
            active &&
            revision === requestedRevision &&
            value &&
            typeof value.workspaceSet === 'boolean'
          )
            setProgress(value);
          return undefined;
        })
        .catch(() => {
          if (active && revision === requestedRevision)
            setProgress(emptyContextProgress());
        });
    };
    refresh();
    const unsubscribe = window.electron?.ipcRenderer.on?.(
      'context-chapter-progress-changed',
      refresh,
    );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return progress;
}
