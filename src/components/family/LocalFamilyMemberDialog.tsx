import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { addHouseholdProfile, DashboardProfile, HouseholdMemberType } from '@/lib/macroGame';
import { upsertChildInChores } from '@/lib/choresSetup';

interface LocalFamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string | null;
  onCreated?: (member: DashboardProfile) => void;
}

export function LocalFamilyMemberDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: LocalFamilyMemberDialogProps) {
  const [name, setName] = useState('');
  const [memberType, setMemberType] = useState<HouseholdMemberType>('adult');
  const [ageInput, setAgeInput] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setName('');
    setMemberType('adult');
    setAgeInput('');
  }, [open]);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const created = addHouseholdProfile(trimmedName, memberType);
    if (memberType === 'child') {
      const parsedAge = ageInput.trim() ? Number.parseInt(ageInput, 10) : null;
      upsertChildInChores(
        {
          id: created.id,
          name: created.name,
          age: Number.isFinite(parsedAge) ? parsedAge : null,
        },
        userId,
      );
    }

    toast({
      title: memberType === 'adult' ? 'Adult added' : 'Kid added',
      description:
        memberType === 'adult'
          ? `${created.name} now has an adult dashboard.`
          : `${created.name} was added to the kids chores section.`,
    });

    onOpenChange(false);
    onCreated?.(created);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add Family Member</DialogTitle>
          <DialogDescription>
            Add an adult dashboard or add a kid directly into chores and the family scoreboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Name</p>
            <Input
              placeholder="Ken, Katie, etc."
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Member type</p>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={memberType}
              onChange={(event) => setMemberType(event.target.value as HouseholdMemberType)}
            >
              <option value="adult">Adult</option>
              <option value="child">Child</option>
            </select>
          </div>

          {memberType === 'child' && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Age (optional)</p>
              <Input
                type="number"
                min={0}
                max={21}
                placeholder="8"
                value={ageInput}
                onChange={(event) => setAgeInput(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you add an age, the starter chores can fit the child a little better.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!name.trim()}>
              Add Member
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
