import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RequireProfileComplete } from "./components/auth/RequireProfileComplete";
import { RequireSubscription } from "./components/auth/RequireSubscription";
import { WorkoutStoreProvider } from "./workouts/hooks/useWorkoutStore";
import { AppLayout } from "./components/layout/AppLayout";

function lazyWithReload<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      const reloadKey = "homehub:lazy-reload-target";
      if (typeof window !== "undefined") {
        const currentTarget = `${window.location.pathname}${window.location.search}`;
        const attemptedTarget = window.sessionStorage.getItem(reloadKey);
        if (attemptedTarget !== currentTarget) {
          window.sessionStorage.setItem(reloadKey, currentTarget);
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

const LandingPage = lazyWithReload(() => import("./pages/LandingPage"));
const FamilyMealPlannerPage = lazyWithReload(() => import("./pages/seo/FamilyMealPlannerPage"));
const SeoResourcesPage = lazyWithReload(() => import("./pages/seo/SeoResourcesPage"));
const AuthPage = lazyWithReload(() => import("./pages/AuthPage"));
const ResetPasswordPage = lazyWithReload(() => import("./pages/ResetPasswordPage"));
const BillingPage = lazyWithReload(() => import("./pages/BillingPage"));
const OnboardingPage = lazyWithReload(() => import("./pages/OnboardingPage"));
const TodayPage = lazyWithReload(() => import("./pages/TodayPage"));
const CalendarPage = lazyWithReload(() => import("./pages/CalendarPage"));
const CalendarPlannerPage = lazyWithReload(() => import("./pages/CalendarPlannerPage"));
const AppleCalendarConnectPage = lazyWithReload(() => import("./pages/AppleCalendarConnectPage"));
const MealsPage = lazyWithReload(() => import("./pages/MealsPage"));
const RecipesPage = lazyWithReload(() => import("./pages/RecipesPage"));
const GroceryPage = lazyWithReload(() => import("./pages/GroceryPage"));
const ChoresPage = lazyWithReload(() => import("./pages/ChoresPage"));
const TasksPage = lazyWithReload(() => import("./pages/TasksPage"));
const FamilyPage = lazyWithReload(() => import("./pages/FamilyPage"));
const SettingsPage = lazyWithReload(() => import("./pages/SettingsPage"));
const GetStartedPage = lazyWithReload(() => import("./pages/GetStartedPage"));
const GetStartedDetailPage = lazyWithReload(() => import("./pages/GetStartedDetailPage"));
const GrowthAnalyticsPage = lazyWithReload(() => import("./pages/GrowthAnalyticsPage"));
const AdminDashboardPage = lazyWithReload(() => import("./pages/AdminDashboardPage"));
const DashboardPage = lazyWithReload(() => import("./pages/DashboardPage"));
const WorkoutsHomePage = lazyWithReload(() => import("./workouts/pages/WorkoutsHomePage"));
const WorkoutSessionPage = lazyWithReload(() => import("./workouts/pages/WorkoutSessionPage"));
const WorkoutTemplatesPage = lazyWithReload(() => import("./workouts/pages/WorkoutTemplatesPage"));
const WorkoutProgressPage = lazyWithReload(() => import("./workouts/pages/WorkoutProgressPage"));
const WorkoutSettingsPage = lazyWithReload(() => import("./workouts/pages/WorkoutSettingsPage"));
const WorkoutDetailPage = lazyWithReload(() => import("./workouts/pages/WorkoutDetailPage"));
const ExerciseHistoryPage = lazyWithReload(() => import("./workouts/pages/ExerciseHistoryPage"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));

const MealPlanHubPage = lazyWithReload(() => import("./pages/seo/MealPlanSeoPages").then((m) => ({ default: m.MealPlanHubPage })));
const MealPlanDetailPage = lazyWithReload(() => import("./pages/seo/MealPlanSeoPages").then((m) => ({ default: m.MealPlanDetailPage })));
const GroceryHubPage = lazyWithReload(() => import("./pages/seo/GrocerySeoPages").then((m) => ({ default: m.GroceryHubPage })));
const GroceryDetailPage = lazyWithReload(() => import("./pages/seo/GrocerySeoPages").then((m) => ({ default: m.GroceryDetailPage })));
const PantryHubPage = lazyWithReload(() => import("./pages/seo/PantrySeoPages").then((m) => ({ default: m.PantryHubPage })));
const PantryDetailPage = lazyWithReload(() => import("./pages/seo/PantrySeoPages").then((m) => ({ default: m.PantryDetailPage })));
const RecipeCollectionHubPage = lazyWithReload(() =>
  import("./pages/seo/RecipeCollectionSeoPages").then((m) => ({ default: m.RecipeCollectionHubPage })),
);
const RecipeCollectionDetailPage = lazyWithReload(() =>
  import("./pages/seo/RecipeCollectionSeoPages").then((m) => ({ default: m.RecipeCollectionDetailPage })),
);
const HouseholdTemplateHubPage = lazyWithReload(() =>
  import("./pages/seo/HouseholdTemplateSeoPages").then((m) => ({ default: m.HouseholdTemplateHubPage })),
);
const HouseholdTemplateDetailPage = lazyWithReload(() =>
  import("./pages/seo/HouseholdTemplateSeoPages").then((m) => ({ default: m.HouseholdTemplateDetailPage })),
);
const MacroHubPage = lazyWithReload(() => import("./pages/seo/MacroSeoPages").then((m) => ({ default: m.MacroHubPage })));
const MacroDetailPage = lazyWithReload(() => import("./pages/seo/MacroSeoPages").then((m) => ({ default: m.MacroDetailPage })));
const ChoreSystemsHubPage = lazyWithReload(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.ChoreSystemsHubPage })));
const ChoreSystemsDetailPage = lazyWithReload(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.ChoreSystemsDetailPage })));
const TaskSystemsHubPage = lazyWithReload(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.TaskSystemsHubPage })));
const TaskSystemsDetailPage = lazyWithReload(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.TaskSystemsDetailPage })));
const WorkoutTrackingHubPage = lazyWithReload(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.WorkoutTrackingHubPage })),
);
const WorkoutTrackingDetailPage = lazyWithReload(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.WorkoutTrackingDetailPage })),
);
const LifestyleTrackingHubPage = lazyWithReload(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.LifestyleTrackingHubPage })),
);
const LifestyleTrackingDetailPage = lazyWithReload(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.LifestyleTrackingDetailPage })),
);
const ComparisonHubPage = lazyWithReload(() =>
  import("./pages/seo/ComparisonSeoPages").then((m) => ({ default: m.ComparisonHubPage })),
);
const ComparisonDetailPage = lazyWithReload(() =>
  import("./pages/seo/ComparisonSeoPages").then((m) => ({ default: m.ComparisonDetailPage })),
);
const TemplatesHubPage = lazyWithReload(() =>
  import("./pages/seo/TemplatesGalleryPages").then((m) => ({ default: m.TemplatesHubPage })),
);
const TemplateDetailPage = lazyWithReload(() =>
  import("./pages/seo/TemplatesGalleryPages").then((m) => ({ default: m.TemplateDetailPage })),
);

const queryClient = new QueryClient();
const GOOGLE_ANALYTICS_ID = "G-PN5Y1S4WCL";

const INDEXABLE_PUBLIC_PREFIXES = [
  "/resources",
  "/family-meal-planner",
  "/meal-plans",
  "/grocery-lists",
  "/pantry-meals",
  "/recipe-collections",
  "/household-templates",
  "/macro-plans",
  "/chore-systems",
  "/task-systems",
  "/workout-tracking",
  "/lifestyle-tracking",
  "/compare",
  "/templates",
];

function upsertRobotsMeta(content: string) {
  let tag = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "robots");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function isPublicIndexablePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return INDEXABLE_PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading page...
    </div>
  );
}

function GoogleAnalyticsPageTracker() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;

    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    window.gtag("config", GOOGLE_ANALYTICS_ID, {
      page_path: pagePath,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [location.hash, location.pathname, location.search]);

  return null;
}

function RouteRobotsController() {
  const location = useLocation();

  useEffect(() => {
    const robotsValue = isPublicIndexablePath(location.pathname)
      ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
      : "noindex,nofollow,noarchive";
    upsertRobotsMeta(robotsValue);
  }, [location.pathname]);

  return null;
}

function LazyRouteRecoveryReset() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem("homehub:lazy-reload-target");
  }, [location.pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkoutStoreProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <GoogleAnalyticsPageTracker />
            <RouteRobotsController />
            <LazyRouteRecoveryReset />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/family-meal-planner" element={<FamilyMealPlannerPage />} />
              <Route path="/resources" element={<SeoResourcesPage />} />
              <Route path="/meal-plans" element={<MealPlanHubPage />} />
              <Route path="/meal-plans/:slug" element={<MealPlanDetailPage />} />
              <Route path="/grocery-lists" element={<GroceryHubPage />} />
              <Route path="/grocery-lists/:slug" element={<GroceryDetailPage />} />
              <Route path="/pantry-meals" element={<PantryHubPage />} />
              <Route path="/pantry-meals/:slug" element={<PantryDetailPage />} />
              <Route path="/recipe-collections" element={<RecipeCollectionHubPage />} />
              <Route path="/recipe-collections/:slug" element={<RecipeCollectionDetailPage />} />
              <Route path="/household-templates" element={<HouseholdTemplateHubPage />} />
              <Route path="/household-templates/:slug" element={<HouseholdTemplateDetailPage />} />
              <Route path="/macro-plans" element={<MacroHubPage />} />
              <Route path="/macro-plans/:slug" element={<MacroDetailPage />} />
              <Route path="/chore-systems" element={<ChoreSystemsHubPage />} />
              <Route path="/chore-systems/:slug" element={<ChoreSystemsDetailPage />} />
              <Route path="/task-systems" element={<TaskSystemsHubPage />} />
              <Route path="/task-systems/:slug" element={<TaskSystemsDetailPage />} />
              <Route path="/workout-tracking" element={<WorkoutTrackingHubPage />} />
              <Route path="/workout-tracking/:slug" element={<WorkoutTrackingDetailPage />} />
              <Route path="/lifestyle-tracking" element={<LifestyleTrackingHubPage />} />
              <Route path="/lifestyle-tracking/:slug" element={<LifestyleTrackingDetailPage />} />
              <Route path="/compare" element={<ComparisonHubPage />} />
              <Route path="/compare/:slug" element={<ComparisonDetailPage />} />
              <Route path="/templates" element={<TemplatesHubPage />} />
              <Route path="/templates/:slug" element={<TemplateDetailPage />} />
              <Route path="/signin" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route
                path="/billing"
                element={
                  <RequireAuth>
                    <RequireProfileComplete>
                      <BillingPage />
                    </RequireProfileComplete>
                  </RequireAuth>
                }
              />
              <Route
                path="/app"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <TodayPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/calendar"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <CalendarPlannerPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/calendar/planner"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <CalendarPlannerPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/calendar/connect-apple"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <AppleCalendarConnectPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/calendar/standard"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <CalendarPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/meals"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <MealsPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/recipes"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <RecipesPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/grocery"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <GroceryPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/chores"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <ChoresPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/tasks"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <TasksPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/family"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <FamilyPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <SettingsPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/getting-started"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <GetStartedPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/getting-started/:topic"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <GetStartedDetailPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/growth-analytics"
                element={
                  <RequireAdmin>
                    <GrowthAnalyticsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminDashboardPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/dashboard/:dashboardId"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <DashboardPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route path="/me" element={<Navigate to="/dashboard/me" replace />} />
              <Route path="/wife" element={<Navigate to="/dashboard/wife" replace />} />
                <Route
                  path="/workouts"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutsHomePage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/new"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutSessionPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/:id"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutDetailPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/templates"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutTemplatesPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/progress"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutProgressPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/settings"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <WorkoutSettingsPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route
                  path="/workouts/exercise/:name"
                  element={
                    <RequireProfileComplete>
                      <RequireSubscription>
                        <AppLayout>
                          <ExerciseHistoryPage />
                        </AppLayout>
                      </RequireSubscription>
                    </RequireProfileComplete>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </WorkoutStoreProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
