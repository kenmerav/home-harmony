import { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExerciseSearch } from '@/workouts/components/ExerciseSearch';
import type { WorkoutTemplate } from '@/workouts/types/workout';

interface TemplateExercise {
  name: string;
  targetSets: number;
  targetReps?: number;
}

interface CreateTemplateModalProps {
  customExercises: string[];
  onSave: (template: Omit<WorkoutTemplate, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  onAddCustomExercise: (name: string) => void;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function CreateTemplateModal({
  customExercises,
  onSave,
  onClose,
  onAddCustomExercise,
}: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<TemplateExercise[]>([]);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);

  const handleAddExercise = (exerciseName: string) => {
    setExercises(prev => [...prev, { name: exerciseName, targetSets: 3, targetReps: 8 }]);
    setShowExerciseSearch(false);
  };

  const handleUpdateExercise = (index: number, updates: Partial<TemplateExercise>) => {
    setExercises(prev => prev.map((ex, i) => (i === index ? { ...ex, ...updates } : ex)));
  };

  const handleRemoveExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim() || exercises.length === 0) return;
    onSave({ name: name.trim(), exercises });
    onClose();
  };

  const canSave = name.trim() && exercises.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border">
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold text-foreground">New Template</h1>
        <Button variant="default" size="sm" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Template Name */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Template Name</label>
          <Input
            placeholder="e.g. Push Day, Leg Day"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-12"
          />
        </div>

        {/* Exercises */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">Exercises</label>

          {exercises.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-xl">
              <p className="text-sm">No exercises added yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-card rounded-xl border border-border p-3"
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{ex.name}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Sets:</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={ex.targetSets}
                          onChange={e =>
                            handleUpdateExercise(index, { targetSets: parseInt(e.target.value) || 1 })
                          }
                          className="w-16 h-8 text-center"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Reps:</span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={ex.targetReps || ''}
                          onChange={e =>
                            handleUpdateExercise(index, {
                              targetReps: parseInt(e.target.value) || undefined,
                            })
                          }
                          className="w-16 h-8 text-center"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemoveExercise(index)}
                    className="flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full mt-4 h-12"
            onClick={() => setShowExerciseSearch(true)}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Exercise
          </Button>
        </div>
      </div>

      {/* Exercise Search Modal */}
      {showExerciseSearch && (
        <ExerciseSearch
          customExercises={customExercises}
          onSelect={handleAddExercise}
          onClose={() => setShowExerciseSearch(false)}
          onAddCustom={onAddCustomExercise}
        />
      )}
    </div>
  );
}
