import { Button } from '@/components/ui/button';

interface BottomCTAProps {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  loading?: boolean;
}

export function BottomCTA({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  loading,
}: BottomCTAProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {secondaryLabel && onSecondary && (
        <Button type="button" variant="ghost" onClick={onSecondary}>
          {secondaryLabel}
        </Button>
      )}
      <Button type="button" onClick={onPrimary} disabled={primaryDisabled || loading} className="min-w-36">
        {loading ? 'Saving...' : primaryLabel}
      </Button>
    </div>
  );
}
