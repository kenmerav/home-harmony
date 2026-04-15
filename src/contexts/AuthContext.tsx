import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { TablesUpdate } from '@/integrations/supabase/types';
import { isDemoModeEnabled, setDemoModeEnabled } from '@/lib/demoMode';
import { resetDemoStore } from '@/lib/demoStore';
import { claimReferral } from '@/lib/api/referrals';
import { clearPendingReferralCode, readPendingReferralCode } from '@/lib/referral';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { BILLING_ENABLED, isBillingExemptEmail } from '@/lib/billing';
import {
  hydrateMacroGameActivityFromAccount,
  hydrateMacroGameProfilesFromAccount,
  setHideBuiltInWifeDashboard,
  setMacroGameStorageScope,
} from '@/lib/macroGame';
import { hydrateMealBudgetPlannerFromAccount, setMealBudgetPlannerStorageScope } from '@/lib/mealBudgetPlanner';
import { hydrateTasksFromAccount, setTaskStorageScope } from '@/lib/taskStore';
import { syncDerivedCalendarSnapshot } from '@/lib/calendarFeed';
import { getHouseholdDashboard } from '@/lib/api/family';
import { clearSharedHouseholdScope, setSharedHouseholdScope } from '@/lib/householdScope';
import { hydrateMealPrefsFromAccount } from '@/lib/mealPrefs';
import { hydrateGroceryPrefsFromAccount } from '@/lib/groceryPrefs';
import { hydrateChoresStateFromAccount } from '@/lib/choresStateStore';

export type SubscriptionStatus = 'active' | 'trialing' | 'inactive' | 'past_due' | 'canceled' | string;

interface SubscriptionInfo {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  priceId: string | null;
}

interface ProfileInfo {
  fullName: string | null;
  householdName: string | null;
  phone: string | null;
  familySize: number | null;
  goals: string | null;
  dietaryPreferences: string[];
  timezone: string | null;
  onboardingCompletedAt: string | null;
}

interface AuthContextValue {
  user: User | null;
  isDemoUser: boolean;
  isAdmin: boolean;
  loading: boolean;
  sharedHouseholdOwnerId: string | null;
  profile: ProfileInfo | null;
  profileLoading: boolean;
  isProfileComplete: boolean;
  subscription: SubscriptionInfo | null;
  subscriptionLoading: boolean;
  isSubscribed: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    profile?: { fullName?: string; householdName?: string; timezone?: string },
  ) => Promise<{ sessionCreated: boolean }>;
  requestPasswordReset: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  startDemoSession: () => Promise<void>;
  updateProfile: (updates: TablesUpdate<'profiles'>) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_PROFILE: ProfileInfo = {
  fullName: 'Demo User',
  householdName: 'Demo Household',
  phone: null,
  familySize: 4,
  goals: 'Save time, eat better, and simplify shopping.',
  dietaryPreferences: ['Kid Friendly', 'High Protein'],
  timezone: 'America/New_York',
  onboardingCompletedAt: new Date().toISOString(),
};

const ADMIN_EMAIL = 'kroberts035@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [sharedHouseholdOwnerId, setSharedHouseholdOwnerId] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    if (isDemoUser) {
      setProfile(DEMO_PROFILE);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name,household_name,phone,family_size,goals,dietary_preferences,timezone,onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setProfile(null);
    } else {
      setProfile({
        fullName: data?.full_name || null,
        householdName: data?.household_name || null,
        phone: data?.phone || null,
        familySize: data?.family_size || null,
        goals: data?.goals || null,
        dietaryPreferences: data?.dietary_preferences || [],
        timezone: data?.timezone || null,
        onboardingCompletedAt: data?.onboarding_completed_at || null,
      });
    }
    setProfileLoading(false);
  }, [isDemoUser, user]);

  const refreshSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setSubscriptionLoading(false);
      return;
    }
    if (isBillingExemptEmail(user.email)) {
      setSubscription({
        status: 'active',
        currentPeriodEnd: null,
        trialEndsAt: null,
        priceId: 'complimentary-lifetime-access',
      });
      setSubscriptionLoading(false);
      return;
    }
    if (!BILLING_ENABLED) {
      setSubscription({
        status: 'active',
        currentPeriodEnd: null,
        trialEndsAt: null,
        priceId: null,
      });
      setSubscriptionLoading(false);
      return;
    }
    if (isDemoUser) {
      setSubscription({
        status: 'active',
        currentPeriodEnd: null,
        trialEndsAt: null,
        priceId: 'demo-price',
      });
      setSubscriptionLoading(false);
      return;
    }
    setSubscriptionLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status,current_period_end,trial_ends_at,price_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load subscription:', error.message);
      setSubscription(null);
    } else {
      const nextSubscription = {
        status: data?.status || 'inactive',
        currentPeriodEnd: data?.current_period_end || null,
        trialEndsAt: data?.trial_ends_at || null,
        priceId: data?.price_id || null,
      };

      const activeStatuses = new Set(['active', 'trialing']);
      if (!activeStatuses.has(String(nextSubscription.status || '').toLowerCase())) {
        try {
          const household = await getHouseholdDashboard();
          const activeMembers = (household.members || []).filter((member) => member.status === 'active');
          const currentMember = activeMembers.find((member) => member.user_id === user.id) || null;
          if (currentMember && currentMember.role !== 'owner') {
            setSubscription({
              status: 'active',
              currentPeriodEnd: null,
              trialEndsAt: null,
              priceId: 'household-shared-access',
            });
            setSubscriptionLoading(false);
            return;
          }
        } catch (householdError) {
          console.error('Failed to load household coverage for subscription:', householdError);
        }
      }

      setSubscription(nextSubscription);
    }
    setSubscriptionLoading(false);
  }, [isDemoUser, user]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (isDemoModeEnabled()) {
        // Demo mode is disabled for users; clear any stale local flag/state.
        setDemoModeEnabled(false);
        resetDemoStore();
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setIsDemoUser(false);
      setUser(data.session?.user ?? null);
      setProfileLoading(Boolean(data.session?.user));
      setSubscriptionLoading(Boolean(data.session?.user) && BILLING_ENABLED && !isBillingExemptEmail(data.session?.user?.email));
      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsDemoUser(false);
      setUser(session?.user ?? null);
      setProfileLoading(Boolean(session?.user));
      setSubscriptionLoading(Boolean(session?.user) && BILLING_ENABLED && !isBillingExemptEmail(session?.user?.email));
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshSubscription();
    refreshProfile();
  }, [refreshProfile, refreshSubscription, user?.id]);

  useEffect(() => {
    setMacroGameStorageScope(!isDemoUser ? user?.id : null);
    setMealBudgetPlannerStorageScope(!isDemoUser ? (sharedHouseholdOwnerId || user?.id) : null);
    setTaskStorageScope(!isDemoUser ? (sharedHouseholdOwnerId || user?.id) : null);
    setHideBuiltInWifeDashboard(false);
    if (!isDemoUser && user?.id) {
      setSharedHouseholdScope(user.id, sharedHouseholdOwnerId || user.id);
    } else {
      clearSharedHouseholdScope();
    }
  }, [isDemoUser, sharedHouseholdOwnerId, user?.id]);

  useEffect(() => {
    if (!user?.id || isDemoUser) {
      setHideBuiltInWifeDashboard(false);
      setSharedHouseholdOwnerId(null);
      return;
    }

    let cancelled = false;

    const syncHouseholdDashboardMode = async () => {
      try {
        const household = await getHouseholdDashboard();
        if (cancelled) return;

        const activeMembers = (household.members || []).filter((member) => member.status === 'active');
        const currentMember = activeMembers.find((member) => member.user_id === user.id) || null;
        const ownerMember = activeMembers.find((member) => member.role === 'owner') || null;
        const hasOtherActiveSpouse = activeMembers.some(
          (member) => member.role === 'spouse' && member.user_id !== user.id,
        );
        const shouldHide = currentMember?.role === 'spouse' || hasOtherActiveSpouse;
        setHideBuiltInWifeDashboard(shouldHide);
        setSharedHouseholdOwnerId(ownerMember?.user_id || user.id);
      } catch {
        if (!cancelled) {
          setHideBuiltInWifeDashboard(false);
          setSharedHouseholdOwnerId(user.id);
        }
      }
    };

    void syncHouseholdDashboardMode();
    return () => {
      cancelled = true;
    };
  }, [isDemoUser, user?.id]);

  useEffect(() => {
    if (!user?.id || isDemoUser) return;

    const refreshMacroState = () => {
      void hydrateMacroGameProfilesFromAccount(user.id);
      void hydrateMacroGameActivityFromAccount(user.id);
      void hydrateMealPrefsFromAccount(sharedHouseholdOwnerId || user.id);
      void hydrateGroceryPrefsFromAccount(sharedHouseholdOwnerId || user.id);
      void hydrateChoresStateFromAccount(sharedHouseholdOwnerId || user.id);
      void hydrateMealBudgetPlannerFromAccount(sharedHouseholdOwnerId || user.id);
      void hydrateTasksFromAccount(sharedHouseholdOwnerId || user.id);
      void syncDerivedCalendarSnapshot(sharedHouseholdOwnerId || user.id, new Date());
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshMacroState();
      }
    };

    refreshMacroState();
    window.addEventListener('focus', refreshMacroState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshMacroState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDemoUser, sharedHouseholdOwnerId, user?.id]);

  useEffect(() => {
    if (!user?.id || isDemoUser || typeof window === 'undefined') return;

    const handleTaskStateUpdated = () => {
      void syncDerivedCalendarSnapshot(sharedHouseholdOwnerId || user.id, new Date());
    };

    window.addEventListener('homehub:task-state-updated', handleTaskStateUpdated);
    return () => window.removeEventListener('homehub:task-state-updated', handleTaskStateUpdated);
  }, [isDemoUser, sharedHouseholdOwnerId, user?.id]);

  useEffect(() => {
    if (!user?.id || isDemoUser || typeof window === 'undefined') return;

    const handleChoresStateUpdated = () => {
      void syncDerivedCalendarSnapshot(sharedHouseholdOwnerId || user.id, new Date());
    };

    window.addEventListener('homehub:chores-state-updated', handleChoresStateUpdated);
    return () => window.removeEventListener('homehub:chores-state-updated', handleChoresStateUpdated);
  }, [isDemoUser, sharedHouseholdOwnerId, user?.id]);

  useEffect(() => {
    if (!user || isDemoUser) return;
    const userId = user.id;

    const referralCode = readPendingReferralCode();
    if (!referralCode) return;

    let cancelled = false;
    const run = async () => {
      try {
        const claimed = await claimReferral(referralCode);
        if (claimed) {
          await trackGrowthEventSafe('referral_claimed', { code: referralCode }, `referral_claimed:${userId}`);
        }
      } catch (error) {
        console.error('Failed claiming referral code:', error);
      } finally {
        if (!cancelled) clearPendingReferralCode();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isDemoUser, user]);

  const value = useMemo<AuthContextValue>(() => {
    const profileFieldComplete = Boolean(
      profile?.fullName?.trim() &&
      typeof profile?.familySize === 'number' &&
      profile.familySize > 0 &&
      profile?.goals?.trim() &&
      profile.dietaryPreferences.length > 0,
    );
    const isProfileComplete = Boolean(profile?.onboardingCompletedAt || profileFieldComplete);
    const status = subscription?.status || 'inactive';
    const isBillingExempt = !isDemoUser && isBillingExemptEmail(user?.email);
    const isSubscribed = !BILLING_ENABLED || isBillingExempt || status === 'active' || status === 'trialing';
    const userEmail = user?.email?.trim().toLowerCase() || '';
    const isAdmin = !isDemoUser && userEmail === ADMIN_EMAIL;

    return {
      user,
      isDemoUser,
      isAdmin,
      loading,
      sharedHouseholdOwnerId,
      profile,
      profileLoading,
      isProfileComplete,
      subscription,
      subscriptionLoading,
      isSubscribed,
      signIn: async (email, password) => {
        if (isDemoUser) {
          setDemoModeEnabled(false);
          setIsDemoUser(false);
          setUser(null);
          setProfile(null);
          setSubscription(null);
          const { error: demoSignOutError } = await supabase.auth.signOut();
          if (demoSignOutError) {
            console.error('Failed to clear demo session before sign in:', demoSignOutError.message);
          }
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      signUp: async (email, password, profile) => {
        if (isDemoUser) {
          setDemoModeEnabled(false);
          setIsDemoUser(false);
          setUser(null);
          setProfile(null);
          setSubscription(null);
          const { error: demoSignOutError } = await supabase.auth.signOut();
          if (demoSignOutError) {
            console.error('Failed to clear demo session before sign up:', demoSignOutError.message);
          }
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: profile?.fullName || null,
              household_name: profile?.householdName || null,
              timezone: profile?.timezone || null,
            },
          },
        });
        if (error) throw error;
        return { sessionCreated: Boolean(data.session) };
      },
      requestPasswordReset: async (email, redirectTo) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
        if (error) throw error;
      },
      updatePassword: async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      updateEmail: async (email) => {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setUser(data.user ?? null);
      },
      signOut: async () => {
        if (isDemoUser) {
          const { error } = await supabase.auth.signOut();
          if (error) console.error('Failed to sign out demo session:', error.message);
          setDemoModeEnabled(false);
          resetDemoStore();
          setLoading(false);
          setProfileLoading(false);
          setSubscriptionLoading(false);
          setUser(null);
          setIsDemoUser(false);
          setProfile(null);
          setSubscription(null);
          return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
      startDemoSession: async () => {
        throw new Error('Demo mode is disabled. Please create an account to start your trial.');
      },
      updateProfile: async (updates) => {
        if (!user) throw new Error('You must be signed in to update profile.');
        if (isDemoUser) {
          setProfile((prev) => ({
            fullName: (updates.full_name as string | undefined) ?? prev?.fullName ?? null,
            householdName: (updates.household_name as string | undefined) ?? prev?.householdName ?? null,
            phone: (updates.phone as string | undefined) ?? prev?.phone ?? null,
            familySize: (updates.family_size as number | undefined) ?? prev?.familySize ?? null,
            goals: (updates.goals as string | undefined) ?? prev?.goals ?? null,
            dietaryPreferences: (updates.dietary_preferences as string[] | undefined) ?? prev?.dietaryPreferences ?? [],
            timezone: prev?.timezone ?? null,
            onboardingCompletedAt: prev?.onboardingCompletedAt ?? null,
          }));
          return;
        }
        const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
        if (error) throw error;
        await refreshProfile();
      },
      refreshProfile,
      refreshSubscription,
    };
  }, [
    loading,
    isDemoUser,
    profile,
    profileLoading,
    refreshProfile,
    refreshSubscription,
    sharedHouseholdOwnerId,
    subscription,
    subscriptionLoading,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
