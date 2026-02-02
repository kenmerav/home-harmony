import { cn } from '@/lib/utils';
import { Macros } from '@/types';

interface MacroBarProps {
  current: Macros;
  target?: Macros;
  compact?: boolean;
}

export function MacroBar({ current, target, compact }: MacroBarProps) {
  const macros = [
    { key: 'calories', label: 'Cal', value: current.calories, target: target?.calories, color: 'bg-accent' },
    { key: 'protein_g', label: 'Protein', value: current.protein_g, target: target?.protein_g, color: 'bg-primary', unit: 'g' },
    { key: 'carbs_g', label: 'Carbs', value: current.carbs_g, target: target?.carbs_g, color: 'bg-warning', unit: 'g' },
    { key: 'fat_g', label: 'Fat', value: current.fat_g, target: target?.fat_g, color: 'bg-info', unit: 'g' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-sm">
        {macros.map((macro) => (
          <span key={macro.key} className="text-muted-foreground">
            <span className="font-medium text-foreground">{Math.round(macro.value)}</span>
            {macro.unit || ''} {macro.label.toLowerCase()}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {macros.map((macro) => {
        const percentage = macro.target ? Math.min((macro.value / macro.target) * 100, 100) : 0;
        
        return (
          <div key={macro.key} className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">{macro.label}</span>
              <span className="text-sm font-medium">
                {Math.round(macro.value)}
                {macro.unit}
              </span>
            </div>
            {macro.target && (
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all duration-300", macro.color)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}
            {macro.target && (
              <span className="text-[10px] text-muted-foreground">
                / {macro.target}{macro.unit}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
