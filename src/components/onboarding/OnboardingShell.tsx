import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';

interface OnboardingShellProps {
  children: ReactNode;
  footer: ReactNode;
  progress: number;
  canGoBack: boolean;
  onBack: () => void;
}

export function OnboardingShell({ children, footer, progress, canGoBack, onBack }: OnboardingShellProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/70 px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBack}
              disabled={!canGoBack}
              className="px-2"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <HomeHarmonyLogo />
            <div className="w-16" />
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className="flex-1 grid place-items-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-sm p-6 md:p-10 min-h-[460px]">
          {children}
        </div>
      </main>

      <footer className="sticky bottom-0 border-t border-border/70 bg-background/95 backdrop-blur px-4 md:px-8 py-4">
        <div className="max-w-3xl mx-auto">{footer}</div>
      </footer>
    </div>
  );
}
