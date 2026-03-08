import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MoreVertical, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateTemplateModal } from '@/workouts/components/CreateTemplateModal';
import { WorkoutsBottomNav } from '@/workouts/components/WorkoutsBottomNav';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { cn } from '@/lib/utils';
import type { WorkoutTemplate } from '@/workouts/types/workout';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function Templates() {
  const { templates, addTemplate, deleteTemplate, workouts, customExercises, addCustomExercise } =
    useWorkoutStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState('All goals');
  const [selectedEquipment, setSelectedEquipment] = useState('All equipment');
  const [selectedSplit, setSelectedSplit] = useState('All splits');

  const goalOptions = useMemo(() => {
    const goals = new Set<string>();
    templates.forEach(template => template.labels?.goals?.forEach(goal => goals.add(goal)));
    return ['All goals', ...Array.from(goals)];
  }, [templates]);

  const equipmentOptions = useMemo(() => {
    const equipment = new Set<string>();
    templates.forEach(template => template.labels?.equipment?.forEach(item => equipment.add(item)));
    return ['All equipment', ...Array.from(equipment)];
  }, [templates]);

  const splitOptions = useMemo(() => {
    const splits = new Set<string>();
    templates.forEach(template => {
      if (template.labels?.split) splits.add(template.labels.split);
    });
    return ['All splits', ...Array.from(splits)];
  }, [templates]);

  const filteredTemplates = useMemo(
    () =>
      templates.filter(template => {
        const goalMatch =
          selectedGoal === 'All goals' || template.labels?.goals?.includes(selectedGoal);
        const equipmentMatch =
          selectedEquipment === 'All equipment' || template.labels?.equipment?.includes(selectedEquipment);
        const splitMatch =
          selectedSplit === 'All splits' || template.labels?.split === selectedSplit;
        return goalMatch && equipmentMatch && splitMatch;
      }),
    [selectedEquipment, selectedGoal, selectedSplit, templates],
  );

  const handleCreateFromWorkout = (workoutId: string) => {
    const workout = workouts.find(w => w.id === workoutId);
    if (!workout) return;

    const name = prompt('Template name:');
    if (!name) return;

    const template: WorkoutTemplate = {
      id: generateId(),
      name,
      exercises: workout.exercises.map(e => ({
        name: e.name,
        targetSets: e.sets.length,
        targetReps: e.sets[0]?.reps || 8,
      })),
      createdAt: Date.now(),
    };

    addTemplate(template);
  };

  const handleCreateTemplate = (data: Omit<WorkoutTemplate, 'id' | 'createdAt'>) => {
    const template: WorkoutTemplate = {
      id: generateId(),
      ...data,
      createdAt: Date.now(),
    };
    addTemplate(template);
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="px-4 pt-8 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground mt-1">Save time with workout templates</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </header>

      <div className="px-4 space-y-3">
        {templates.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3 space-y-3">
            <p className="text-sm font-medium text-foreground">Find by goal, equipment, and split</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={selectedGoal}
                onChange={event => setSelectedGoal(event.target.value)}
              >
                {goalOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={selectedEquipment}
                onChange={event => setSelectedEquipment(event.target.value)}
              >
                {equipmentOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                value={selectedSplit}
                onChange={event => setSelectedSplit(event.target.value)}
              >
                {splitOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">No templates yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Create a template or save one from a workout
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="font-medium text-foreground">No templates match those filters</p>
            <p className="mt-1 text-sm text-muted-foreground">Try widening goal, equipment, or split.</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div key={template.id} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{template.name}</h3>
                  <p className="text-sm text-muted-foreground">{template.exercises.length} exercises</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.labels?.goals?.slice(0, 2).map(goal => (
                      <span
                        key={`${template.id}-${goal}`}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                      >
                        {goal}
                      </span>
                    ))}
                    {template.labels?.equipment?.[0] && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {template.labels.equipment[0]}
                      </span>
                    )}
                    {template.labels?.split && (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {template.labels.split}
                      </span>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setActiveMenu(activeMenu === template.id ? null : template.id)}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {activeMenu === template.id && (
                    <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-popover border border-border rounded-lg shadow-xl z-10 animate-scale-in">
                      <button
                        onClick={() => {
                          deleteTemplate(template.id);
                          setActiveMenu(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1 mb-4">
                {template.exercises.slice(0, 4).map((ex, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {ex.name} • {ex.targetSets} sets
                  </p>
                ))}
                {template.exercises.length > 4 && (
                  <p className="text-sm text-muted-foreground">+{template.exercises.length - 4} more</p>
                )}
              </div>

              <Link to={`/workouts/new?template=${template.id}`}>
                <Button variant="outline" className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Start Workout
                </Button>
              </Link>
            </div>
          ))
        )}

        {/* Create from recent workout */}
        {workouts.length > 0 && (
          <div className="pt-6">
            <h2 className="font-semibold text-foreground mb-3">Create from Recent</h2>
            <div className="space-y-2">
              {workouts.slice(0, 5).map(workout => (
                <button
                  key={workout.id}
                  onClick={() => handleCreateFromWorkout(workout.id)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl bg-secondary border border-border',
                    'hover:bg-secondary/80 transition-colors',
                  )}
                >
                  <p className="font-medium text-foreground">
                    {new Date(`${workout.date}T00:00:00`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {workout.exercises
                      .map(e => e.name)
                      .slice(0, 3)
                      .join(', ')}
                    {workout.exercises.length > 3 && ` +${workout.exercises.length - 3}`}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateTemplateModal
          customExercises={customExercises}
          onSave={handleCreateTemplate}
          onClose={() => setShowCreateModal(false)}
          onAddCustomExercise={addCustomExercise}
        />
      )}
      <WorkoutsBottomNav />
    </div>
  );
}
