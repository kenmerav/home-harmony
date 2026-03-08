import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, MoreVertical, History, Trophy, MessageSquare, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Exercise, WorkoutSet } from '@/workouts/types/workout';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  exercise: Exercise;
  previousData?: { weight: number; reps: number; sets: number; notes?: string } | null;
  onUpdateSet: (setId: string, updates: Partial<WorkoutSet>) => void;
  onUpdateNotes: (notes: string) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onCompleteSet: (setId: string) => void;
  onDeleteExercise: () => void;
  onViewHistory: () => void;
  weightUnit: 'lb' | 'kg';
  isPR?: boolean;
}

export function ExerciseCard({
  exercise,
  previousData,
  onUpdateSet,
  onUpdateNotes,
  onAddSet,
  onDeleteSet,
  onCompleteSet,
  onDeleteExercise,
  onViewHistory,
  weightUnit,
  isPR,
}: ExerciseCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [showNotes, setShowNotes] = useState(!!exercise.notes || !!previousData?.notes);

  const completedSets = exercise.sets.filter(s => s.isCompleted).length;
  const totalSets = exercise.sets.length;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden animate-scale-in">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{exercise.name}</h3>
              {isPR && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-accent/20 rounded-full">
                  <Trophy className="h-3 w-3 text-accent" />
                  <span className="text-xs font-medium text-accent">PR!</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {completedSets}/{totalSets} sets
              {previousData && (
                <span className="ml-2">
                  • Last: {previousData.sets}×{previousData.reps} @ {previousData.weight}{weightUnit}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowOptions(!showOptions);
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Options dropdown */}
      {showOptions && (
        <div className="px-4 pb-2 flex gap-2 animate-fade-in">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowNotes(!showNotes);
              setShowOptions(false);
            }}
          >
            <StickyNote className="h-4 w-4 mr-1" />
            Notes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onViewHistory();
              setShowOptions(false);
            }}
          >
            <History className="h-4 w-4 mr-1" />
            History
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              onDeleteExercise();
              setShowOptions(false);
            }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
        </div>
      )}

      {/* Sets */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="pb-1">
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[24px_56px_minmax(0,1fr)_56px_24px] sm:grid-cols-[40px_1fr_1fr_1fr_40px] gap-2 px-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
                <span>SET</span>
                <span className="text-center">PREV</span>
                <span className="text-center">{weightUnit.toUpperCase()}</span>
                <span className="text-center">REPS</span>
                <span></span>
              </div>

              {/* Set rows */}
              {exercise.sets.map((set, index) => (
                <SetRow
                  key={set.id}
                  set={set}
                  setNumber={index + 1}
                  previousWeight={previousData?.weight}
                  previousReps={previousData?.reps}
                  onUpdate={(updates) => onUpdateSet(set.id, updates)}
                  onComplete={() => onCompleteSet(set.id)}
                  onDelete={() => onDeleteSet(set.id)}
                  weightUnit={weightUnit}
                />
              ))}
            </div>
          </div>

          {/* Add set button */}
          <Button
            variant="subtle"
            size="sm"
            className="w-full mt-2"
            onClick={onAddSet}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Set
          </Button>

          {/* Notes section */}
          {showNotes && (
            <div className="mt-3 space-y-2">
              {previousData?.notes && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>Last session note:</span>
                  </div>
                  <p className="text-sm text-foreground">{previousData.notes}</p>
                </div>
              )}
              <Textarea
                placeholder="Add a note for next time (e.g., 'Go up 5lbs next week')"
                value={exercise.notes || ''}
                onChange={(e) => onUpdateNotes(e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
