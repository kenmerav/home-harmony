import { useState } from 'react';
import { X, Bike, Footprints, PersonStanding, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CardioSession } from '@/workouts/types/workout';

interface AddCardioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: Omit<CardioSession, 'id'>) => void;
  distanceUnit: 'mi' | 'km';
}

const CARDIO_TYPES: { type: CardioSession['type']; label: string; icon: React.ElementType }[] = [
  { type: 'run', label: 'Run', icon: Footprints },
  { type: 'walk', label: 'Walk', icon: PersonStanding },
  { type: 'bike', label: 'Bike', icon: Bike },
  { type: 'other', label: 'Other', icon: Activity },
];

export function AddCardioModal({ isOpen, onClose, onSave, distanceUnit }: AddCardioModalProps) {
  const [selectedType, setSelectedType] = useState<CardioSession['type']>('run');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!duration) return;

    onSave({
      type: selectedType,
      date: new Date().toLocaleDateString('en-CA'),
      duration: parseFloat(duration) || 0,
      distance: parseFloat(distance) || 0,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setSelectedType('run');
    setDuration('');
    setDistance('');
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-fade-in">
      <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Add Cardio</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Type Selection */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-3 block">Type</label>
          <div className="grid grid-cols-4 gap-2">
            {CARDIO_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl border transition-colors",
                  selectedType === type
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Duration (minutes)
          </label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="30"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="text-lg"
          />
        </div>

        {/* Distance */}
        <div className="mb-4">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Distance ({distanceUnit})
          </label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="3.0"
            step="0.1"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="text-lg"
          />
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">
            Notes (optional)
          </label>
          <Textarea
            placeholder="How did it feel?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave} disabled={!duration}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
