import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { WorkoutSet } from '@/workouts/types/workout';

interface SetRowProps {
  set: WorkoutSet;
  setNumber: number;
  previousWeight?: number;
  previousReps?: number;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onDelete: () => void;
  weightUnit: 'lb' | 'kg';
}

export function SetRow({
  set,
  setNumber,
  previousWeight,
  previousReps,
  onUpdate,
  onComplete,
  onDelete,
  weightUnit,
}: SetRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleWeightChange = (value: string) => {
    const weight = parseFloat(value) || 0;
    onUpdate({ weight });
  };

  const handleRepsChange = (value: string) => {
    const reps = parseInt(value) || 0;
    onUpdate({ reps });
  };

  const quickAdjust = (field: 'weight' | 'reps', delta: number) => {
    if (field === 'weight') {
      onUpdate({ weight: Math.max(0, set.weight + delta) });
    } else {
      onUpdate({ reps: Math.max(0, set.reps + delta) });
    }
  };

  return (
    <div className={cn(
      "grid grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 items-center p-2 rounded-lg transition-colors",
      set.isCompleted ? "bg-success/10" : "bg-muted/30",
      isEditing && "bg-secondary"
    )}>
      {/* Set number */}
      <span className={cn(
        "text-center font-semibold",
        set.isCompleted ? "text-success" : "text-muted-foreground"
      )}>
        {setNumber}
      </span>

      {/* Previous */}
      <span className="text-center text-sm text-muted-foreground">
        {previousWeight && previousReps ? (
          `${previousWeight}×${previousReps}`
        ) : (
          '-'
        )}
      </span>

      {/* Weight input */}
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          value={set.weight || ''}
          onChange={(e) => handleWeightChange(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          disabled={set.isCompleted}
          className={cn(
            "w-full text-center py-2 px-1 rounded-md bg-input border border-border text-foreground font-medium",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          )}
          placeholder="0"
        />
        {!set.isCompleted && (
          <div className="absolute -bottom-5 left-0 right-0 flex justify-center gap-1 opacity-0 group-focus-within:opacity-100 transition-opacity">
            {[2.5, 5, -2.5, -5].map((delta) => (
              <button
                key={delta}
                onClick={() => quickAdjust('weight', delta)}
                className="text-[10px] text-muted-foreground hover:text-primary"
              >
                {delta > 0 ? '+' : ''}{delta}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reps input */}
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          value={set.reps || ''}
          onChange={(e) => handleRepsChange(e.target.value)}
          onFocus={() => setIsEditing(true)}
          onBlur={() => setIsEditing(false)}
          disabled={set.isCompleted}
          className={cn(
            "w-full text-center py-2 px-1 rounded-md bg-input border border-border text-foreground font-medium",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          )}
          placeholder="0"
        />
      </div>

      {/* Complete/Delete button */}
      {set.isCompleted ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive/50 hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-success hover:bg-success/20"
          onClick={onComplete}
          disabled={!set.weight || !set.reps}
        >
          <Check className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
