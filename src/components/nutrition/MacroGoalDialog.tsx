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
  const [waterTargetOz, setWaterTargetOz] = useState(profile.macroPlan.waterTargetOz);
  const [alcoholLimitDrinks, setAlcoholLimitDrinks] = useState(profile.macroPlan.alcoholLimitDrinks);

  useEffect(() => {
    if (!open) return;
    const next = getProfiles()[personId];
    setQuestionnaire(next.macroPlan.questionnaire);
    setBodyUnitSystem(next.macroPlan.bodyUnitSystem || 'imperial');
    setFinalMacros({
      calories: next.macroPlan.calories,
      protein_g: next.macroPlan.protein_g,
      carbs_g: next.macroPlan.carbs_g,
      fat_g: next.macroPlan.fat_g,
    });
    setProteinOnlyMode(next.macroPlan.proteinOnlyMode);
    setWaterTargetOz(next.macroPlan.waterTargetOz);
    setAlcoholLimitDrinks(next.macroPlan.alcoholLimitDrinks);
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
  };

  const save = () => {
    updateMacroPlan(personId, {
      questionnaire,
      bodyUnitSystem,
      calories: Math.max(1000, Math.round(finalMacros.calories)),
      protein_g: Math.max(40, Math.round(finalMacros.protein_g)),
      carbs_g: Math.max(20, Math.round(finalMacros.carbs_g)),
      fat_g: Math.max(20, Math.round(finalMacros.fat_g)),
      proteinOnlyMode,
      waterTargetOz: Math.max(16, Math.round(waterTargetOz)),
      alcoholLimitDrinks: Math.max(0, Number(alcoholLimitDrinks.toFixed(1))),
    });
    onOpenChange(false);
    onSaved?.();
    toast({ title: 'Macro goals saved' });
  };

  const totalInches = Math.max(48, Math.round(questionnaire.heightCm / 2.54));
  const heightFeet = Math.floor(totalInches / 12);
  const heightInches = totalInches % 12;
  const weightLb = Number((questionnaire.weightKg * 2.20462).toFixed(1));

  const updateImperialHeight = (feet: number, inches: number) => {
    const normalizedFeet = Math.max(3, feet);
    const normalizedInches = Math.min(11, Math.max(0, inches));
    const heightCm = Math.round((normalizedFeet * 12 + normalizedInches) * 2.54);
    setQuestionnaire((prev) => ({ ...prev, heightCm }));
  };

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
                onClick={() => setBodyUnitSystem('imperial')}
              >
                Imperial (ft/in, lb)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bodyUnitSystem === 'metric' ? 'default' : 'outline'}
                onClick={() => setBodyUnitSystem('metric')}
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
                value={questionnaire.age}
                onChange={(e) =>
                  setQuestionnaire((prev) => ({ ...prev, age: Number.parseInt(e.target.value, 10) || 30 }))
                }
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
                    value={heightFeet}
                    onChange={(e) =>
                      updateImperialHeight(Number.parseInt(e.target.value, 10) || 5, heightInches)
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Height (in)</p>
                  <Input
                    type="number"
                    min={0}
                    max={11}
                    value={heightInches}
                    onChange={(e) =>
                      updateImperialHeight(heightFeet, Number.parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Weight (lb)</p>
                  <Input
                    type="number"
                    min={80}
                    step="0.1"
                    value={weightLb}
                    onChange={(e) =>
                      setQuestionnaire((prev) => ({
                        ...prev,
                        weightKg: Number.parseFloat(((Number.parseFloat(e.target.value) || 154) / 2.20462).toFixed(2)),
                      }))
                    }
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
                    value={questionnaire.heightCm}
                    onChange={(e) =>
                      setQuestionnaire((prev) => ({ ...prev, heightCm: Number.parseInt(e.target.value, 10) || 170 }))
                    }
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Weight (kg)</p>
                  <Input
                    type="number"
                    min={35}
                    step="0.1"
                    value={questionnaire.weightKg}
                    onChange={(e) =>
                      setQuestionnaire((prev) => ({ ...prev, weightKg: Number.parseFloat(e.target.value) || 70 }))
                    }
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
                  value={finalMacros.calories}
                  onChange={(e) =>
                    setFinalMacros((prev) => ({ ...prev, calories: Number.parseInt(e.target.value, 10) || 0 }))
                  }
                  placeholder="Calories"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Protein (g)</p>
                <Input
                  type="number"
                  value={finalMacros.protein_g}
                  onChange={(e) =>
                    setFinalMacros((prev) => ({ ...prev, protein_g: Number.parseInt(e.target.value, 10) || 0 }))
                  }
                  placeholder="Protein (g)"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Carbs (g)</p>
                <Input
                  type="number"
                  value={finalMacros.carbs_g}
                  onChange={(e) =>
                    setFinalMacros((prev) => ({ ...prev, carbs_g: Number.parseInt(e.target.value, 10) || 0 }))
                  }
                  placeholder="Carbs (g)"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Fat (g)</p>
                <Input
                  type="number"
                  value={finalMacros.fat_g}
                  onChange={(e) =>
                    setFinalMacros((prev) => ({ ...prev, fat_g: Number.parseInt(e.target.value, 10) || 0 }))
                  }
                  placeholder="Fat (g)"
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <Checkbox checked={proteinOnlyMode} onCheckedChange={(checked) => setProteinOnlyMode(!!checked)} />
              <span className="text-sm">Protein-only success mode</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Water target (oz)</p>
                <Input
                  type="number"
                  min={16}
                  value={waterTargetOz}
                  onChange={(e) => setWaterTargetOz(Number.parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Alcohol limit (drinks/day)</p>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={alcoholLimitDrinks}
                  onChange={(e) => setAlcoholLimitDrinks(Number.parseFloat(e.target.value) || 0)}
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
