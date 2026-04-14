import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AdultId,
  AdultScoreSettings,
  ActivityLevel,
  BodyUnitSystem,
  BodyGoal,
  GoalPace,
  MacroQuestionnaire,
  calculateMacroRecommendation,
  getProfiles,
  updateMacroPlan,
} from '@/lib/macroGame';
import { useToast } from '@/hooks/use-toast';

interface MacroGoalDialogProps {
  personId: AdultId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

function normalizeIntegerInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.replace(/^0+(?=\d)/, '');
}

function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '');
  if (rest.length === 0) return whole;
  return `${whole || '0'}.${rest.join('').replace(/\./g, '')}`;
}

function parseIntegerInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDecimalInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function activityLabel(level: ActivityLevel): string {
  switch (level) {
    case 'sedentary':
      return 'Sedentary';
    case 'light':
      return 'Light activity';
    case 'moderate':
      return 'Moderate activity';
    case 'active':
      return 'Very active';
    case 'athlete':
      return 'Athlete';
    default:
      return level;
  }
}

function goalLabel(goal: BodyGoal): string {
  switch (goal) {
    case 'fat_loss':
      return 'Fat loss';
    case 'maintenance':
      return 'Maintenance';
    case 'muscle_gain':
      return 'Muscle gain';
    case 'recomp':
      return 'Recomposition';
    default:
      return goal;
  }
}

export function MacroGoalDialog({ personId, open, onOpenChange, onSaved }: MacroGoalDialogProps) {
  const { toast } = useToast();
  const profile = getProfiles()[personId];
  const [questionnaire, setQuestionnaire] = useState<MacroQuestionnaire>(profile.macroPlan.questionnaire);
  const [bodyUnitSystem, setBodyUnitSystem] = useState<BodyUnitSystem>(profile.macroPlan.bodyUnitSystem || 'imperial');
  const [finalMacros, setFinalMacros] = useState({
    calories: profile.macroPlan.calories,
    protein_g: profile.macroPlan.protein_g,
    carbs_g: profile.macroPlan.carbs_g,
    fat_g: profile.macroPlan.fat_g,
  });
  const [proteinOnlyMode, setProteinOnlyMode] = useState(profile.macroPlan.proteinOnlyMode);
  const [scorePointsFor, setScorePointsFor] = useState<AdultScoreSettings>(profile.macroPlan.scorePointsFor);
  const [ageInput, setAgeInput] = useState(String(profile.macroPlan.questionnaire.age));
  const [heightFeetInput, setHeightFeetInput] = useState('');
  const [heightInchesInput, setHeightInchesInput] = useState('');
  const [heightCmInput, setHeightCmInput] = useState(String(profile.macroPlan.questionnaire.heightCm));
  const [weightInput, setWeightInput] = useState('');
  const [finalMacroInputs, setFinalMacroInputs] = useState({
    calories: String(profile.macroPlan.calories),
    protein_g: String(profile.macroPlan.protein_g),
    carbs_g: String(profile.macroPlan.carbs_g),
    fat_g: String(profile.macroPlan.fat_g),
  });
  const [waterTargetInput, setWaterTargetInput] = useState(String(profile.macroPlan.waterTargetOz));
  const [alcoholLimitInput, setAlcoholLimitInput] = useState(String(profile.macroPlan.alcoholLimitDrinks));

  const syncQuestionnaireDrafts = (nextQuestionnaire: MacroQuestionnaire, nextUnitSystem: BodyUnitSystem) => {
    setAgeInput(String(nextQuestionnaire.age));
    setHeightCmInput(String(nextQuestionnaire.heightCm));
    const totalInches = Math.max(48, Math.round(nextQuestionnaire.heightCm / 2.54));
    setHeightFeetInput(String(Math.floor(totalInches / 12)));
    setHeightInchesInput(String(totalInches % 12));
    setWeightInput(
      nextUnitSystem === 'imperial'
        ? Number((nextQuestionnaire.weightKg * 2.20462).toFixed(1)).toString()
        : Number(nextQuestionnaire.weightKg.toFixed(1)).toString(),
    );
  };

  useEffect(() => {
    if (!open) return;
    const next = getProfiles()[personId];
    setQuestionnaire(next.macroPlan.questionnaire);
    const nextUnitSystem = next.macroPlan.bodyUnitSystem || 'imperial';
    setBodyUnitSystem(nextUnitSystem);
    setFinalMacros({
      calories: next.macroPlan.calories,
      protein_g: next.macroPlan.protein_g,
      carbs_g: next.macroPlan.carbs_g,
      fat_g: next.macroPlan.fat_g,
    });
    setFinalMacroInputs({
      calories: String(next.macroPlan.calories),
      protein_g: String(next.macroPlan.protein_g),
      carbs_g: String(next.macroPlan.carbs_g),
      fat_g: String(next.macroPlan.fat_g),
    });
    setProteinOnlyMode(next.macroPlan.proteinOnlyMode);
    setScorePointsFor(next.macroPlan.scorePointsFor);
    setWaterTargetInput(String(next.macroPlan.waterTargetOz));
    setAlcoholLimitInput(String(next.macroPlan.alcoholLimitDrinks));
    syncQuestionnaireDrafts(next.macroPlan.questionnaire, nextUnitSystem);
  }, [open, personId]);

  const recommendation = useMemo(
    () => calculateMacroRecommendation(questionnaire),
    [questionnaire],
  );

  const applyRecommendation = () => {
    setFinalMacros({
      calories: recommendation.calories,
      protein_g: recommendation.protein_g,
      carbs_g: recommendation.carbs_g,
      fat_g: recommendation.fat_g,
    });
    setFinalMacroInputs({
      calories: String(recommendation.calories),
      protein_g: String(recommendation.protein_g),
      carbs_g: String(recommendation.carbs_g),
      fat_g: String(recommendation.fat_g),
    });
  };

  const updateFinalMacroField = (
    field: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g',
    rawValue: string,
  ) => {
    const nextValue = normalizeIntegerInput(rawValue);
    setFinalMacroInputs((prev) => {
      const nextInputs = { ...prev, [field]: nextValue };
      if (field === 'calories') {
        const parsedCalories = parseIntegerInput(nextValue);
        if (parsedCalories !== null) {
          setFinalMacros((current) => ({ ...current, calories: parsedCalories }));
        }
        return nextInputs;
      }

      const protein = field === 'protein_g' ? parseIntegerInput(nextValue) ?? 0 : parseIntegerInput(nextInputs.protein_g) ?? 0;
      const carbs = field === 'carbs_g' ? parseIntegerInput(nextValue) ?? 0 : parseIntegerInput(nextInputs.carbs_g) ?? 0;
      const fat = field === 'fat_g' ? parseIntegerInput(nextValue) ?? 0 : parseIntegerInput(nextInputs.fat_g) ?? 0;
      const calories = protein * 4 + carbs * 4 + fat * 9;

      nextInputs.calories = String(calories);
      setFinalMacros({
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      });
      return nextInputs;
    });
  };

  const save = () => {
    const calories = parseIntegerInput(finalMacroInputs.calories);
    const protein_g = parseIntegerInput(finalMacroInputs.protein_g);
    const carbs_g = parseIntegerInput(finalMacroInputs.carbs_g);
    const fat_g = parseIntegerInput(finalMacroInputs.fat_g);
    const waterTarget = parseIntegerInput(waterTargetInput);
    const alcoholLimit = parseDecimalInput(alcoholLimitInput);

    if (calories === null || protein_g === null || carbs_g === null || fat_g === null) {
      toast({
        title: 'Finish your macro targets',
        description: 'Calories, protein, carbs, and fat all need values before saving.',
        variant: 'destructive',
      });
      return;
    }

    const macroCalories = protein_g * 4 + carbs_g * 4 + fat_g * 9;
    if (Math.abs(calories - macroCalories) > 10) {
      toast({
        title: 'Calories and macros do not match',
        description: `Those macros add up to ${macroCalories} calories, so adjust the targets before saving.`,
        variant: 'destructive',
      });
      return;
    }

    if (waterTarget === null || alcoholLimit === null) {
      toast({
        title: 'Finish the extra targets',
        description: 'Water and alcohol targets need valid values before saving.',
        variant: 'destructive',
      });
      return;
    }

    updateMacroPlan(personId, {
      questionnaire,
      bodyUnitSystem,
      calories: Math.max(1000, Math.round(calories)),
      protein_g: Math.max(40, Math.round(protein_g)),
      carbs_g: Math.max(20, Math.round(carbs_g)),
      fat_g: Math.max(20, Math.round(fat_g)),
      proteinOnlyMode,
      waterTargetOz: Math.max(16, Math.round(waterTarget)),
      alcoholLimitDrinks: Math.max(0, Number(alcoholLimit.toFixed(1))),
      scorePointsFor,
    });
    onOpenChange(false);
    onSaved?.();
    toast({ title: 'Macro goals saved' });
  };

  const updateImperialHeight = (feet: number, inches: number) => {
    const normalizedFeet = Math.max(3, feet);
    const normalizedInches = Math.min(11, Math.max(0, inches));
    const heightCm = Math.round((normalizedFeet * 12 + normalizedInches) * 2.54);
    setQuestionnaire((prev) => ({ ...prev, heightCm }));
  };

  const macroCalories = finalMacros.protein_g * 4 + finalMacros.carbs_g * 4 + finalMacros.fat_g * 9;
  const macroCalorieDelta = finalMacros.calories - macroCalories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Macro Calculator</DialogTitle>
          <DialogDescription>
            Questionnaire-based calories + macro recommendation with editable final targets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Questionnaire (used to calculate calories)</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={bodyUnitSystem === 'imperial' ? 'default' : 'outline'}
                onClick={() => {
                  setBodyUnitSystem('imperial');
                  syncQuestionnaireDrafts(questionnaire, 'imperial');
                }}
              >
                Imperial (ft/in, lb)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bodyUnitSystem === 'metric' ? 'default' : 'outline'}
                onClick={() => {
                  setBodyUnitSystem('metric');
                  syncQuestionnaireDrafts(questionnaire, 'metric');
                }}
              >
                Metric (cm, kg)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sex</p>
              <Select
                value={questionnaire.sex}
                onValueChange={(value) =>
                  setQuestionnaire((prev) => ({ ...prev, sex: value as MacroQuestionnaire['sex'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Age</p>
              <Input
                type="number"
                min={12}
                value={ageInput}
                onChange={(e) => {
                  const nextValue = normalizeIntegerInput(e.target.value);
                  setAgeInput(nextValue);
                  const parsed = parseIntegerInput(nextValue);
                  if (parsed !== null) {
                    setQuestionnaire((prev) => ({ ...prev, age: parsed }));
                  }
                }}
              />
            </div>
            {bodyUnitSystem === 'imperial' ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Height (ft)</p>
                  <Input
                    type="number"
                    min={3}
                    max={8}
                    value={heightFeetInput}
                    onChange={(e) => {
                      const nextValue = normalizeIntegerInput(e.target.value);
                      setHeightFeetInput(nextValue);
                      const feet = parseIntegerInput(nextValue);
                      const inches = parseIntegerInput(heightInchesInput);
                      if (feet !== null && inches !== null) {
                        updateImperialHeight(feet, inches);
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Height (in)</p>
                  <Input
                    type="number"
                    min={0}
                    max={11}
                    value={heightInchesInput}
                    onChange={(e) => {
                      const nextValue = normalizeIntegerInput(e.target.value);
                      setHeightInchesInput(nextValue);
                      const feet = parseIntegerInput(heightFeetInput);
                      const inches = parseIntegerInput(nextValue);
                      if (feet !== null && inches !== null) {
                        updateImperialHeight(feet, inches);
                      }
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Weight (lb)</p>
                  <Input
                    type="number"
                    min={80}
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => {
                      const nextValue = normalizeDecimalInput(e.target.value);
                      setWeightInput(nextValue);
                      const parsed = parseDecimalInput(nextValue);
                      if (parsed !== null) {
                        setQuestionnaire((prev) => ({
                          ...prev,
                          weightKg: Number.parseFloat((parsed / 2.20462).toFixed(2)),
                        }));
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Height (cm)</p>
                  <Input
                    type="number"
                    min={120}
                    value={heightCmInput}
                    onChange={(e) => {
                      const nextValue = normalizeIntegerInput(e.target.value);
                      setHeightCmInput(nextValue);
                      const parsed = parseIntegerInput(nextValue);
                      if (parsed !== null) {
                        setQuestionnaire((prev) => ({ ...prev, heightCm: parsed }));
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weight (kg)</p>
                  <Input
                    type="number"
                    min={35}
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => {
                      const nextValue = normalizeDecimalInput(e.target.value);
                      setWeightInput(nextValue);
                      const parsed = parseDecimalInput(nextValue);
                      if (parsed !== null) {
                        setQuestionnaire((prev) => ({ ...prev, weightKg: parsed }));
                      }
                    }}
                  />
                </div>
              </>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Activity level</p>
              <Select
                value={questionnaire.activityLevel}
                onValueChange={(value) =>
                  setQuestionnaire((prev) => ({ ...prev, activityLevel: value as ActivityLevel }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['sedentary', 'light', 'moderate', 'active', 'athlete'] as ActivityLevel[]).map((level) => (
                    <SelectItem key={level} value={level}>
                      {activityLabel(level)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Goal</p>
              <Select
                value={questionnaire.goal}
                onValueChange={(value) =>
                  setQuestionnaire((prev) => ({ ...prev, goal: value as BodyGoal }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['fat_loss', 'maintenance', 'muscle_gain', 'recomp'] as BodyGoal[]).map((goal) => (
                    <SelectItem key={goal} value={goal}>
                      {goalLabel(goal)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pace</p>
              <Select
                value={questionnaire.pace}
                onValueChange={(value) =>
                  setQuestionnaire((prev) => ({ ...prev, pace: value as GoalPace }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slow">Slow</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recommended (from questionnaire)</p>
              <Button size="sm" variant="outline" onClick={applyRecommendation}>
                Use Recommendation
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {recommendation.calories} cal • {recommendation.protein_g}P • {recommendation.carbs_g}C •{' '}
              {recommendation.fat_g}F
            </p>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-sm font-medium">Final targets (editable)</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Calories</p>
                <Input
                  type="number"
                  value={finalMacroInputs.calories}
                  onChange={(e) => updateFinalMacroField('calories', e.target.value)}
                  placeholder="Calories"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Protein (g)</p>
                <Input
                  type="number"
                  value={finalMacroInputs.protein_g}
                  onChange={(e) => updateFinalMacroField('protein_g', e.target.value)}
                  placeholder="Protein (g)"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Carbs (g)</p>
                <Input
                  type="number"
                  value={finalMacroInputs.carbs_g}
                  onChange={(e) => updateFinalMacroField('carbs_g', e.target.value)}
                  placeholder="Carbs (g)"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Fat (g)</p>
                <Input
                  type="number"
                  value={finalMacroInputs.fat_g}
                  onChange={(e) => updateFinalMacroField('fat_g', e.target.value)}
                  placeholder="Fat (g)"
                />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/10 px-3 py-2 text-sm">
              <p className="font-medium">Macro calories: {macroCalories}</p>
              <p className={Math.abs(macroCalorieDelta) <= 10 ? 'text-muted-foreground' : 'text-destructive'}>
                {Math.abs(macroCalorieDelta) <= 10
                  ? 'Calories and macros are aligned.'
                  : macroCalorieDelta > 0
                    ? `${macroCalorieDelta} calories are unaccounted for by your macros.`
                    : `Macros are ${Math.abs(macroCalorieDelta)} calories over your calorie target.`}
              </p>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox checked={proteinOnlyMode} onCheckedChange={(checked) => setProteinOnlyMode(!!checked)} />
              <span className="text-sm">Protein-only success mode</span>
            </label>
            <div className="rounded-md border border-border bg-muted/10 px-3 py-3 space-y-2">
              <p className="text-sm font-medium">Score points for</p>
              <p className="text-xs text-muted-foreground">
                Choose which habits actually count toward this adult&apos;s leaderboard score.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ['protein', 'Protein target'],
                  ['calories', 'Calories on target'],
                  ['water', 'Water target'],
                  ['alcohol', 'Alcohol goal'],
                  ['meals', 'Meals logged'],
                  ['consistency', 'Consistency bonus'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={scorePointsFor[key as keyof AdultScoreSettings]}
                      onCheckedChange={(checked) =>
                        setScorePointsFor((prev) => ({
                          ...prev,
                          [key]: !!checked,
                        }))
                      }
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Water target (oz)</p>
                <Input
                  type="number"
                  min={16}
                  value={waterTargetInput}
                  onChange={(e) => {
                    const nextValue = normalizeIntegerInput(e.target.value);
                    setWaterTargetInput(nextValue);
                  }}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Alcohol limit (drinks/day)</p>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={alcoholLimitInput}
                  onChange={(e) => {
                    const nextValue = normalizeDecimalInput(e.target.value);
                    setAlcoholLimitInput(nextValue);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Targets</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
