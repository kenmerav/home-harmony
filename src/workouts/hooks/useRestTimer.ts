import { useState, useEffect, useCallback, useRef } from 'react';

interface UseRestTimerOptions {
  defaultDuration: number;
  onComplete?: () => void;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
}

export function useRestTimer({
  defaultDuration,
  onComplete,
  soundEnabled = true,
  vibrationEnabled = true,
}: UseRestTimerOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(defaultDuration);
  const [totalDuration, setTotalDuration] = useState(defaultDuration);
  const [elapsedSinceLastSet, setElapsedSinceLastSet] = useState(0);
  
  // Use end timestamp for background-resistant timing
  const endTimeRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasCompletedRef = useRef(false);

  // Create audio context for notification
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQQAWK3h6sFmEwA0mt7x4IdEABmN3fPwmVoABITb9fWsawAAc9j195xrAABn0PX3kWsAAF/K9fd/awAAWsT19m9rAABXvvX2X2sAAFW49fZQawAAVLH19kFrAABTq/X2MmsAAFOl9fYkawAAU5/19hdrAABUmfX2C2sAAFaT9fYAawAAWI319fZqAABckfX17GoAAGGM9fXjagAAZ4b19dlqAABugfX1z2oAAHZ89fXFagAAfnf19btqAACHcvX1smoAAJBt9fWoagAAmGj19Z9qAACgY/X1lmoAAKle9fWNagAAsVn19YRqAAC5VPX1e2oAAMFP9fVyagAAyUr19WlqAADRRfX1YGoAANlA9fVXagAA4Tv19U5qAADpNvX1RWoAAPEx9fU8agAA+Sz19TNqAAABKPX1KmoAAAkj9fUhagAAER719RhqAAAZGfX1D2oAACEU9fUGagAAKQ/19f1pAAAxCvX19GkAADkF9fXraQAAQQD19eJpAABJ+/T12WkAAFH29PXQAQA=');
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  const playNotification = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    if (vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [soundEnabled, vibrationEnabled]);

  // Calculate time remaining based on end timestamp
  const calculateTimeRemaining = useCallback(() => {
    if (!endTimeRef.current) return timeRemaining;
    const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    return remaining;
  }, [timeRemaining]);

  const handleComplete = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    setIsRunning(false);
    setTimeRemaining(0);
    playNotification();
    
    if (startTimeRef.current) {
      setElapsedSinceLastSet(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
    onComplete?.();
  }, [playNotification, onComplete]);

  const start = useCallback((duration?: number) => {
    const dur = duration ?? defaultDuration;
    setTotalDuration(dur);
    setTimeRemaining(dur);
    setIsRunning(true);
    hasCompletedRef.current = false;
    startTimeRef.current = Date.now();
    endTimeRef.current = Date.now() + dur * 1000;
  }, [defaultDuration]);

  const pause = useCallback(() => {
    setIsRunning(false);
    // Store remaining time when paused
    if (endTimeRef.current) {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);
      endTimeRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    setIsRunning(true);
    hasCompletedRef.current = false;
    // Set new end time based on remaining time
    endTimeRef.current = Date.now() + timeRemaining * 1000;
  }, [timeRemaining]);

  const skip = useCallback(() => {
    setIsRunning(false);
    if (startTimeRef.current) {
      setElapsedSinceLastSet(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }
    startTimeRef.current = null;
    endTimeRef.current = null;
  }, []);

  const addTime = useCallback((seconds: number) => {
    setTimeRemaining(prev => prev + seconds);
    setTotalDuration(prev => prev + seconds);
    if (endTimeRef.current) {
      endTimeRef.current += seconds * 1000;
    }
  }, []);

  const reset = useCallback((duration?: number) => {
    const dur = duration ?? defaultDuration;
    setTimeRemaining(dur);
    setTotalDuration(dur);
    setIsRunning(false);
    hasCompletedRef.current = false;
    startTimeRef.current = null;
    endTimeRef.current = null;
  }, [defaultDuration]);

  // Handle visibility change (app comes back from background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isRunning && endTimeRef.current) {
        const remaining = calculateTimeRemaining();
        setTimeRemaining(remaining);
        
        if (remaining <= 0 && !hasCompletedRef.current) {
          handleComplete();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, calculateTimeRemaining, handleComplete]);

  // Timer tick effect
  useEffect(() => {
    if (isRunning && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        if (endTimeRef.current) {
          const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
          setTimeRemaining(remaining);
          
          if (remaining <= 0 && !hasCompletedRef.current) {
            handleComplete();
          }
        }
      }, 250); // Update more frequently for smoother display
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, handleComplete]);

  const progress = totalDuration > 0 ? (totalDuration - timeRemaining) / totalDuration : 0;

  return {
    isRunning,
    timeRemaining,
    totalDuration,
    progress,
    elapsedSinceLastSet,
    start,
    pause,
    resume,
    skip,
    addTime,
    reset,
  };
}
