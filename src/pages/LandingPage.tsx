import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSeoMeta } from '@/lib/seo';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import {
  CTA,
  Features,
  Hero,
  HowItWorks,
  LifestyleBand,
  ProblemSection,
  Testimonials,
} from '@/components/landing/LandingSections';

export default function LandingPage() {
  const { user, isDemoUser } = useAuth();
  const startFreeHref = user ? '/onboarding?force=1' : '/signin?onboarding=1';

  const scrollToHowItWorks = () => {
    const section = document.getElementById('how-it-works');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!user?.id || isDemoUser) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    void trackGrowthEventSafe('landing_view', { page: 'landing' }, `landing_view:${dayKey}`);
  }, [user?.id, isDemoUser]);

  useSeoMeta({
    title: 'Bring Calm to Family Life | Home Harmony',
    description:
      'Home Harmony keeps meals, schedules, and routines in one simple place so your week runs smoother and your home feels lighter.',
    keywords: [
      'family schedule app',
      'meal planning app for families',
      'shared grocery list app',
      'household routine app',
      'family organizer app',
    ],
    image: '/landing/hero-family.jpg',
    imageAlt: 'Calm family breakfast table in a cozy kitchen',
    type: 'website',
    breadcrumbs: [{ name: 'Home', url: '/' }],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,hsl(var(--primary)/0.14),transparent_35%),radial-gradient(circle_at_85%_12%,hsl(var(--accent)/0.14),transparent_35%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <HomeHarmonyLogo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={scrollToHowItWorks} className="hidden sm:inline-flex" aria-label="See how Home Harmony works">
              See How It Works
            </Button>
            <Link to="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to={startFreeHref}>
              <Button>Start Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        <Hero startHref={startFreeHref} onSeeHowItWorks={scrollToHowItWorks} />
        <ProblemSection />
        <Features startHref={startFreeHref} />
        <LifestyleBand />
        <Testimonials />
        <HowItWorks />
        <CTA startHref={startFreeHref} />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Link to={startFreeHref} className="flex-1">
            <Button className="w-full" aria-label="Start Free">
              Start Free
            </Button>
          </Link>
          <Button variant="outline" className="flex-1" onClick={scrollToHowItWorks} aria-label="See how Home Harmony works">
            See How It Works
          </Button>
        </div>
      </div>
    </div>
  );
}
