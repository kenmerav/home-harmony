import { cn } from '@/lib/utils';

interface OptionListProps<T extends string> {
  options: readonly T[];
  selected: T[];
  onToggle: (option: T) => void;
  multi?: boolean;
  disabledOptions?: T[];
  optionLabel?: (option: T) => string;
}

export function OptionList<T extends string>({
  options,
  selected,
  onToggle,
  multi = false,
  disabledOptions = [],
  optionLabel,
}: OptionListProps<T>) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        const isDisabled = disabledOptions.includes(option);

        return (
          <button
            key={option}
            type="button"
            onClick={() => !isDisabled && onToggle(option)}
            disabled={isDisabled}
            className={cn(
              'w-full rounded-2xl border px-4 py-4 text-left transition-all text-base',
              isSelected
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border hover:border-primary/50 hover:bg-muted/60',
              isDisabled && 'opacity-50 cursor-not-allowed',
            )}
            aria-pressed={isSelected}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{optionLabel ? optionLabel(option) : option}</span>
              <span
                className={cn(
                  'h-5 w-5 rounded-full border flex items-center justify-center text-[10px]',
                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                )}
              >
                {isSelected ? (multi ? selected.indexOf(option) + 1 : '✓') : ''}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
