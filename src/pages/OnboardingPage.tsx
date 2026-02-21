import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { createOrGetHousehold } from '@/lib/api/family';

const DIETARY_OPTIONS = [
  'High Protein',
  'Kid Friendly',
  'Low Carb',
  'Gluten Free',
  'Dairy Free',
  'Vegetarian',
];

export default function OnboardingPage() {
  const { profile, profileLoading, isProfileComplete, isSubscribed, updateProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [phone, setPhone] = useState('');
  const [familySize, setFamilySize] = useState('');
  const [goals, setGoals] = useState('');
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName || '');
    setHouseholdName(profile.householdName || '');
    setPhone(profile.phone || '');
    setFamilySize(profile.familySize ? String(profile.familySize) : '');
    setGoals(profile.goals || '');
    setDietaryPreferences(profile.dietaryPreferences || []);
  }, [profile]);

  useEffect(() => {
    if (profileLoading || !isProfileComplete) return;
    navigate(isSubscribed ? '/app' : '/billing', { replace: true });
  }, [isProfileComplete, isSubscribed, navigate, profileLoading]);

  const toggleDietary = (value: string, checked: boolean) => {
    setDietaryPreferences((prev) => {
      if (checked) return [...new Set([...prev, value])];
      return prev.filter((item) => item !== value);
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const parsedFamilySize = Number(familySize);
      if (!Number.isFinite(parsedFamilySize) || parsedFamilySize <= 0) {
        throw new Error('Family size must be a number greater than 0.');
      }
      if (dietaryPreferences.length === 0) {
        throw new Error('Select at least one dietary preference.');
      }

      await updateProfile({
        full_name: fullName.trim(),
        household_name: householdName.trim() || null,
        phone: phone.trim() || null,
        family_size: parsedFamilySize,
        goals: goals.trim(),
        dietary_preferences: dietaryPreferences,
      });
      await createOrGetHousehold(householdName.trim() || undefined);

      navigate(isSubscribed ? '/app' : '/billing', { replace: true });
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid place-items-center p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <HomeHarmonyLogo className="mb-6" />
        <h1 className="font-display text-2xl">Complete your profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us a bit about your household so planning, groceries, and recommendations are tailored.
        </p>

        {profileLoading ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading profile...</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full name</Label>
                <Input
                  id="full-name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="household-name">Household name</Label>
                <Input
                  id="household-name"
                  placeholder="Optional"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Optional"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="family-size">Family size</Label>
                <Input
                  id="family-size"
                  type="number"
                  min={1}
                  required
                  value={familySize}
                  onChange={(e) => setFamilySize(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goals">Goals</Label>
              <Textarea
                id="goals"
                required
                placeholder="Example: save time on weeknights, hit protein goals, spend less at the store."
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Dietary preferences</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {DIETARY_OPTIONS.map((option) => {
                  const checked = dietaryPreferences.includes(option);
                  return (
                    <label key={option} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(state) => toggleDietary(option, state === true)} />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {message && <p className="text-sm text-muted-foreground">{message}</p>}

            <Button disabled={submitting} className="w-full md:w-auto">
              {submitting ? 'Saving...' : 'Save and continue'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
