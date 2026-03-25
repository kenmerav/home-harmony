import { useEffect, useState } from 'react';
import { format } from 'date-fns';

export function useCurrentDate() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const updateIfNeeded = () => {
      const now = new Date();
      setCurrentDate((previous) =>
        format(previous, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd') ? previous : now,
      );
    };

    const timer = window.setInterval(updateIfNeeded, 60_000);
    const onFocus = () => updateIfNeeded();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') updateIfNeeded();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return currentDate;
}
