import { useEffect, useState } from 'react';

/** Unknown/unreachable policy never enables tutor controls. */
export default function useStudyAccess() {
  const [allowed, setAllowed] = useState<boolean | null | 'unavailable'>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const value = (await window.electron.ipcRenderer.invoke(
          'study-access',
        )) as { tutoring_allowed?: boolean; status?: string };
        if (mounted) setAllowed(value?.tutoring_allowed === true ? true : value?.status === 'disabled' ? false : value?.status === 'checking' ? null : 'unavailable');
      } catch {
        if (mounted) setAllowed('unavailable');
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
