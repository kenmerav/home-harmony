import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RequireProfileComplete } from "./components/auth/RequireProfileComplete";
import { RequireSubscription } from "./components/auth/RequireSubscription";
import { WorkoutStoreProvider } from "./workouts/hooks/useWorkoutStore";
import { AppLayout } from "./components/layout/AppLayout";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const SeoResourcesPage = lazy(() => import("./pages/seo/SeoResourcesPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));
const TodayPage = lazy(() => import("./pages/TodayPage"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const CalendarPlannerPage = lazy(() => import("./pages/CalendarPlannerPage"));
const MealsPage = lazy(() => import("./pages/MealsPage"));
const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const GroceryPage = lazy(() => import("./pages/GroceryPage"));
const ChoresPage = lazy(() => import("./pages/ChoresPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));
const FamilyPage = lazy(() => import("./pages/FamilyPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const FreeToolsAnalyticsPage = lazy(() => import("./pages/FreeToolsAnalyticsPage"));
const GrowthAnalyticsPage = lazy(() => import("./pages/GrowthAnalyticsPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const MeDashboardPage = lazy(() => import("./pages/MeDashboardPage"));
const WifeDashboardPage = lazy(() => import("./pages/WifeDashboardPage"));
const WorkoutsHomePage = lazy(() => import("./workouts/pages/WorkoutsHomePage"));
const WorkoutSessionPage = lazy(() => import("./workouts/pages/WorkoutSessionPage"));
const WorkoutTemplatesPage = lazy(() => import("./workouts/pages/WorkoutTemplatesPage"));
const WorkoutProgressPage = lazy(() => import("./workouts/pages/WorkoutProgressPage"));
const WorkoutSettingsPage = lazy(() => import("./workouts/pages/WorkoutSettingsPage"));
const WorkoutDetailPage = lazy(() => import("./workouts/pages/WorkoutDetailPage"));
const ExerciseHistoryPage = lazy(() => import("./workouts/pages/ExerciseHistoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const MealPlanHubPage = lazy(() => import("./pages/seo/MealPlanSeoPages").then((m) => ({ default: m.MealPlanHubPage })));
const MealPlanDetailPage = lazy(() => import("./pages/seo/MealPlanSeoPages").then((m) => ({ default: m.MealPlanDetailPage })));
const GroceryHubPage = lazy(() => import("./pages/seo/GrocerySeoPages").then((m) => ({ default: m.GroceryHubPage })));
const GroceryDetailPage = lazy(() => import("./pages/seo/GrocerySeoPages").then((m) => ({ default: m.GroceryDetailPage })));
const PantryHubPage = lazy(() => import("./pages/seo/PantrySeoPages").then((m) => ({ default: m.PantryHubPage })));
const PantryDetailPage = lazy(() => import("./pages/seo/PantrySeoPages").then((m) => ({ default: m.PantryDetailPage })));
const RecipeCollectionHubPage = lazy(() =>
  import("./pages/seo/RecipeCollectionSeoPages").then((m) => ({ default: m.RecipeCollectionHubPage })),
);
const RecipeCollectionDetailPage = lazy(() =>
  import("./pages/seo/RecipeCollectionSeoPages").then((m) => ({ default: m.RecipeCollectionDetailPage })),
);
const HouseholdTemplateHubPage = lazy(() =>
  import("./pages/seo/HouseholdTemplateSeoPages").then((m) => ({ default: m.HouseholdTemplateHubPage })),
);
const HouseholdTemplateDetailPage = lazy(() =>
  import("./pages/seo/HouseholdTemplateSeoPages").then((m) => ({ default: m.HouseholdTemplateDetailPage })),
);
const MacroHubPage = lazy(() => import("./pages/seo/MacroSeoPages").then((m) => ({ default: m.MacroHubPage })));
const MacroDetailPage = lazy(() => import("./pages/seo/MacroSeoPages").then((m) => ({ default: m.MacroDetailPage })));
const ChoreSystemsHubPage = lazy(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.ChoreSystemsHubPage })));
const ChoreSystemsDetailPage = lazy(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.ChoreSystemsDetailPage })));
const TaskSystemsHubPage = lazy(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.TaskSystemsHubPage })));
const TaskSystemsDetailPage = lazy(() => import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.TaskSystemsDetailPage })));
const WorkoutTrackingHubPage = lazy(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.WorkoutTrackingHubPage })),
);
const WorkoutTrackingDetailPage = lazy(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.WorkoutTrackingDetailPage })),
);
const LifestyleTrackingHubPage = lazy(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.LifestyleTrackingHubPage })),
);
const LifestyleTrackingDetailPage = lazy(() =>
  import("./pages/seo/OperationsSeoPages").then((m) => ({ default: m.LifestyleTrackingDetailPage })),
);
const FreeToolsHubPage = lazy(() =>
  import("./pages/seo/FreeToolsPages").then((m) => ({ default: m.FreeToolsHubPage })),
);
const FreeToolsDetailPage = lazy(() =>
  import("./pages/seo/FreeToolsPages").then((m) => ({ default: m.FreeToolsDetailPage })),
);
const ComparisonHubPage = lazy(() =>
  import("./pages/seo/ComparisonSeoPages").then((m) => ({ default: m.ComparisonHubPage })),
);
const ComparisonDetailPage = lazy(() =>
  import("./pages/seo/ComparisonSeoPages").then((m) => ({ default: m.ComparisonDetailPage })),
);
const TemplatesHubPage = lazy(() =>
  import("./pages/seo/TemplatesGalleryPages").then((m) => ({ default: m.TemplatesHubPage })),
);
const TemplateDetailPage = lazy(() =>
  import("./pages/seo/TemplatesGalleryPages").then((m) => ({ default: m.TemplateDetailPage })),
);

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading page...
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WorkoutStoreProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
              <Route path="/" element={<LandingPage />} />
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
              <Route path="/free-tools" element={<FreeToolsHubPage />} />
              <Route path="/free-tools/:slug" element={<FreeToolsDetailPage />} />
              <Route path="/compare" element={<ComparisonHubPage />} />
              <Route path="/compare/:slug" element={<ComparisonDetailPage />} />
              <Route path="/templates" element={<TemplatesHubPage />} />
              <Route path="/templates/:slug" element={<TemplateDetailPage />} />
              <Route path="/signin" element={<AuthPage />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <OnboardingPage />
                  </RequireAuth>
                }
              />
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
                path="/free-tools-analytics"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <FreeToolsAnalyticsPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/growth-analytics"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <GrowthAnalyticsPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
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
                path="/me"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <MeDashboardPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
              <Route
                path="/wife"
                element={
                  <RequireProfileComplete>
                    <RequireSubscription>
                      <WifeDashboardPage />
                    </RequireSubscription>
                  </RequireProfileComplete>
                }
              />
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
