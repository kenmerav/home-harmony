import { HeartHandshake, House } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeHarmonyLogoProps {
  className?: string;
  compact?: boolean;
}

export function HomeHarmonyLogo({ className, compact = false }: HomeHarmonyLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-soft">
        <House className="h-5 w-5" />
        <HeartHandshake className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background p-0.5 text-primary" />
      </div>
      {!compact && (
        <div>
          <p className="font-display text-xl leading-none text-foreground">Home Harmony</p>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Family OS</p>
        </div>
      )}
    </div>
  );
}
