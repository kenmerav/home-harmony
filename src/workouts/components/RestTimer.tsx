import { useEffect } from 'react';
import { Play, Pause, SkipForward, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RestTimerProps {
  isRunning: boolean;
  timeRemaining: number;
  totalDuration: number;
  progress: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function RestTimer({
  isRunning,
  timeRemaining,
  totalDuration,
  progress,
  onPause,
  onResume,
  onSkip,
  onAddTime,
}: RestTimerProps) {
  const isLowTime = timeRemaining <= 10 && timeRemaining > 0;
  const isComplete = timeRemaining === 0 && !isRunning;

  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md",
      "bg-card/95 backdrop-blur-lg border border-border rounded-2xl shadow-2xl",
      "animate-slide-up safe-bottom",
      isLowTime && "animate-timer-pulse border-accent",
      isComplete && "border-success"
    )}>
      <div className="p-4">
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div 
            className={cn(
              "h-full transition-all duration-1000 ease-linear rounded-full",
              isLowTime ? "bg-accent" : "bg-primary",
              isComplete && "bg-success"
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          {/* Timer display */}
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-4xl font-bold tabular-nums",
              isLowTime && "text-accent",
              isComplete && "text-success"
            )}>
              {formatTime(timeRemaining)}
            </span>
            {isComplete && (
              <span className="text-success text-sm font-medium">Rest Complete!</span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {!isComplete && (
              <>
                <Button
                  variant="timer"
                  size="icon-sm"
                  onClick={() => onAddTime(30)}
                  className="text-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">+30s</span>
                </Button>
                
                <Button
                  variant="timer"
                  size="icon"
                  onClick={isRunning ? onPause : onResume}
                >
                  {isRunning ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
              </>
            )}
            
            <Button
              variant={isComplete ? "default" : "ghost"}
              size="icon"
              onClick={onSkip}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Quick add buttons */}
        {!isComplete && (
          <div className="flex gap-2 mt-3">
            <Button 
              variant="subtle" 
              size="sm" 
              className="flex-1"
              onClick={() => onAddTime(30)}
            >
              +30s
            </Button>
            <Button 
              variant="subtle" 
              size="sm" 
              className="flex-1"
              onClick={() => onAddTime(60)}
            >
              +60s
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
