import { ArrowLeft, Clock, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';

interface WorkoutHeaderProps {
  title: string;
  startTime: number;
  onBack: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function WorkoutHeader({
  title,
  startTime,
  onBack,
  onFinish,
  onDiscard,
}: WorkoutHeaderProps) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground truncate max-w-[150px]">
              {title}
            </h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="tabular-nums">{formatDuration(elapsed)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={onFinish}>
            Finish
          </Button>
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon-sm"
              onClick={() => setShowOptions(!showOptions)}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
            {showOptions && (
              <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-popover border border-border rounded-lg shadow-xl animate-scale-in">
                <button
                  onClick={() => {
                    setShowOptions(false);
                    onDiscard();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  Discard Workout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
