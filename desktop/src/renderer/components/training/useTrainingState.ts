import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudyState } from '../../../shared/study';
import { api } from './training-api';

/** Fetch only while Training is open; keep loaded data and drafts across tabs. */
export default function useTrainingState(visible: boolean, refreshKey: number) {
  const [state, setState] = useState<StudyState | null>(null);
  const [studentMode, setStudentMode] = useState(false);
  const [error, setError] = useState('');
  const [hostedTrainingEnabled, setHostedTrainingEnabled] = useState(true);
  const requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    if (!hostedTrainingEnabled) return;
    requestVersion.current += 1;
    const version = requestVersion.current;
    try {
      const access = await api('study-access') as { hosted_training_enabled?: boolean } | undefined;
      if (version !== requestVersion.current) return;
      if (access?.hosted_training_enabled === false) {
        setHostedTrainingEnabled(false);
        setState(null);
        setStudentMode(false);
        setError('');
        return;
      }
      const [data, mode] = (await Promise.all([
        api('study-me'),
        api('study-student-mode'),
      ])) as [StudyState, { enabled?: boolean }];
      if (version !== requestVersion.current) return;
      setState(data);
      setStudentMode(mode?.enabled === true);
      setError('');
    } catch (reason) {
      // A response from a previous visit must not overwrite a newer result.
      if (version !== requestVersion.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    }
  }, [hostedTrainingEnabled]);

  useEffect(() => {
    if (!visible || !hostedTrainingEnabled) return undefined;
    setError('');
    const update = () => {
      refresh().catch(() => undefined);
    };
    update();
    const timer = setInterval(update, 30000);
    return () => {
      clearInterval(timer);
      requestVersion.current += 1;
    };
  }, [visible, refreshKey, refresh, hostedTrainingEnabled]);

  return { state, studentMode, error, setError, refresh, hostedTrainingEnabled };
}
