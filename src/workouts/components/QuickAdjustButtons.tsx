import { Button } from '@/components/ui/button';

interface QuickAdjustButtonsProps {
  onAdjustWeight: (delta: number) => void;
  onRepeatLastSet: () => void;
  weightUnit: 'lb' | 'kg';
  disabled?: boolean;
}

export function QuickAdjustButtons({
  onAdjustWeight,
  onRepeatLastSet,
  weightUnit,
  disabled,
}: QuickAdjustButtonsProps) {
  const increments = weightUnit === 'lb' ? [2.5, 5, 10] : [1.25, 2.5, 5];

  return (
    <div className="flex flex-wrap gap-2">
      {increments.map((inc) => (
        <Button
          key={`minus-${inc}`}
          variant="quick"
          size="sm"
          onClick={() => onAdjustWeight(-inc)}
          disabled={disabled}
        >
          -{inc}
        </Button>
      ))}
      {increments.map((inc) => (
        <Button
          key={`plus-${inc}`}
          variant="quick"
          size="sm"
          onClick={() => onAdjustWeight(inc)}
          disabled={disabled}
        >
          +{inc}
        </Button>
      ))}
      <Button
        variant="subtle"
        size="sm"
        onClick={onRepeatLastSet}
        disabled={disabled}
        className="ml-auto"
      >
        Repeat Last
      </Button>
    </div>
  );
}
