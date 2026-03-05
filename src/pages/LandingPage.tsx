import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSeoMeta } from '@/lib/seo';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import {
  Hero,
  HowItWorks,
  ModulesSection,
  ProofBar,
  SeoFooterLinks,
  SignupSection,
  Testimonials,
} from '@/components/landing/LandingSections';

export default function LandingPage() {
  const { user, isDemoUser } = useAuth();
  const startFreeHref = user ? '/onboarding?force=1' : '/signin?onboarding=1';

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!user?.id || isDemoUser) return;
    const dayKey = new Date().toISOString().slice(0, 10);
    void trackGrowthEventSafe('landing_view', { page: 'landing' }, `landing_view:${dayKey}`);
  }, [user?.id, isDemoUser]);

  useSeoMeta({
    title: 'Home Harmony HQ | Your Home, Finally Running Like Clockwork',
    description:
      'Home Harmony combines meal planning, calorie and macro tracking, workout tracking, daily schedule SMS reminders, and preferred-store grocery quick-add in one family system.',
    keywords: [
      'family schedule app',
      'meal planning app for families',
      'shared grocery list app',
      'household routine app',
      'family organizer app',
      'home management app for families',
      'calorie tracker for families',
      'workout tracker app',
      'sms event reminders',
    ],
    image: '/landing/hero-family.jpg',
    imageAlt: 'Family playing a board game together in a cozy living room',
    type: 'website',
    breadcrumbs: [{ name: 'Home', url: '/' }],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,hsl(var(--primary)/0.14),transparent_35%),radial-gradient(circle_at_85%_12%,hsl(var(--accent)/0.14),transparent_35%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <HomeHarmonyLogo compact />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Landing navigation">
            <Button variant="ghost" onClick={() => scrollToSection('modules')} aria-label="View feature modules">
              Features
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection('how')} aria-label="View how it works">
              How it works
            </Button>
            <Button variant="ghost" onClick={() => scrollToSection('testimonials')} aria-label="View customer stories">
              Stories
            </Button>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => scrollToSection('how')}
              className="hidden sm:inline-flex md:hidden"
              aria-label="See how Home Harmony works"
            >
              See How It Works
            </Button>
            <Link to="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to={startFreeHref}>
              <Button>Get Started Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        <Hero
          startHref={startFreeHref}
          onSeeHowItWorks={() => scrollToSection('how')}
          onExploreFeatures={() => scrollToSection('modules')}
        />
        <ProofBar />
        <ModulesSection startHref={startFreeHref} />
        <HowItWorks />
        <Testimonials />
        <SignupSection startHref={startFreeHref} />
        <SeoFooterLinks />
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Link to={startFreeHref} className="flex-1">
            <Button className="w-full" aria-label="Start Free">
              Start Free
            </Button>
          </Link>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => scrollToSection('how')}
            aria-label="See how Home Harmony works"
          >
            See How It Works
          </Button>
        </div>
      </div>
    </div>
  );
}
