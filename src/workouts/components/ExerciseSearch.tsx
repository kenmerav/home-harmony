import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DEFAULT_EXERCISES } from '@/workouts/types/workout';

interface ExerciseSearchProps {
  customExercises: string[];
  onSelect: (exerciseName: string) => void;
  onClose: () => void;
  onAddCustom: (name: string) => void;
}

export function ExerciseSearch({
  customExercises,
  onSelect,
  onClose,
  onAddCustom,
}: ExerciseSearchProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allExercises = useMemo(() => {
    return [...new Set([...customExercises, ...DEFAULT_EXERCISES])].sort();
  }, [customExercises]);

  const filteredExercises = useMemo(() => {
    if (!search.trim()) return allExercises;
    const searchLower = search.toLowerCase();
    return allExercises.filter(ex => 
      ex.toLowerCase().includes(searchLower)
    );
  }, [allExercises, search]);

  const showAddCustom = search.trim() && 
    !allExercises.some(ex => ex.toLowerCase() === search.toLowerCase().trim());

  const handleAddCustom = () => {
    const name = search.trim();
    if (name) {
      onAddCustom(name);
      onSelect(name);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col h-full max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className={cn(
                "w-full h-12 pl-10 pr-4 rounded-xl bg-input border border-border",
                "text-foreground placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              )}
            />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Exercise list */}
        <div className="flex-1 overflow-y-auto p-4">
          {showAddCustom && (
            <button
              onClick={handleAddCustom}
              className={cn(
                "w-full flex items-center gap-3 p-4 mb-2 rounded-xl",
                "bg-primary/10 border border-primary/30 text-primary",
                "hover:bg-primary/20 transition-colors"
              )}
            >
              <Plus className="h-5 w-5" />
              <span className="font-medium">Add "{search.trim()}"</span>
            </button>
          )}

          <div className="space-y-1">
            {filteredExercises.map((exercise) => (
              <button
                key={exercise}
                onClick={() => onSelect(exercise)}
                className={cn(
                  "w-full text-left p-4 rounded-xl",
                  "bg-card hover:bg-secondary transition-colors",
                  "text-foreground font-medium"
                )}
              >
                {exercise}
              </button>
            ))}
          </div>

          {filteredExercises.length === 0 && !showAddCustom && (
            <div className="text-center py-12 text-muted-foreground">
              No exercises found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
