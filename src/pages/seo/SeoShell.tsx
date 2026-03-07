import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { Button } from '@/components/ui/button';

export function SeoShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/">
            <HomeHarmonyLogo />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/resources">
              <Button variant="ghost">Resources</Button>
            </Link>
            <Link to="/onboarding">
              <Button>Open App</Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">{children}</main>
    </div>
  );
}
