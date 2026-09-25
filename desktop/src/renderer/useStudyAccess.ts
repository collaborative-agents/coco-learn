import { useEffect, useState } from 'react';

/** Unknown/unreachable policy never enables tutor controls. */
export default function useStudyAccess() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const value = (await window.electron.ipcRenderer.invoke(
          'study-access',
        )) as { tutoring_allowed?: boolean };
        if (mounted) setAllowed(value?.tutoring_allowed === true);
      } catch {
        if (mounted) setAllowed(false);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 3000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
  return allowed;
}
