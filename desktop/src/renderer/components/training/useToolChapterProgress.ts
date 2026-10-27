import { useEffect, useState } from 'react';
import {
  emptyToolProgress,
  type ToolChapterProgress,
} from '../../../shared/tool-exploration';

export default function useToolChapterProgress() {
  const [progress, setProgress] =
    useState<ToolChapterProgress>(emptyToolProgress);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const refresh = () => {
      revision += 1;
      const requestedRevision = revision;
      Promise.resolve(
        window.electron?.ipcRenderer.invoke('tool-chapter-progress'),
      )
        .then((value) => {
          if (
            active &&
            revision === requestedRevision &&
            value &&
            typeof value.approved === 'boolean'
          )
            setProgress(value);
          return undefined;
        })
        .catch(() => {
          if (active && revision === requestedRevision)
            setProgress(emptyToolProgress());
        });
    };
    refresh();
    const unsubscribe = window.electron?.ipcRenderer.on?.(
      'tool-chapter-progress-changed',
      refresh,
    );
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return progress;
}
