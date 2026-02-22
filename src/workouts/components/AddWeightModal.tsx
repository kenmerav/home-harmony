import { useState } from 'react';
import { Scale, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WeightLog } from '@/workouts/types/workout';

interface AddWeightModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (log: Omit<WeightLog, 'id'>) => void;
  weightUnit: 'lb' | 'kg';
  lastWeight?: number;
}

export function AddWeightModal({ open, onClose, onSave, weightUnit, lastWeight }: AddWeightModalProps) {
  const [weight, setWeight] = useState(lastWeight?.toString() || '');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'evening'>('morning');

  const handleSave = () => {
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0) return;

    onSave({
      date,
      weight: weightValue,
      timeOfDay,
    });

    setWeight('');
    setDate(new Date().toLocaleDateString('en-CA'));
    setTimeOfDay('morning');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Log Body Weight
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="weight">Weight ({weightUnit})</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={`Enter weight in ${weightUnit}`}
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>Time of Day</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <Button
                type="button"
                variant={timeOfDay === 'morning' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setTimeOfDay('morning')}
              >
                <Sun className="h-4 w-4" />
                Morning
              </Button>
              <Button
                type="button"
                variant={timeOfDay === 'evening' ? 'default' : 'outline'}
                className="flex items-center gap-2"
                onClick={() => setTimeOfDay('evening')}
              >
                <Moon className="h-4 w-4" />
                Evening
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            className="flex-1" 
            onClick={handleSave}
            disabled={!weight || parseFloat(weight) <= 0}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
