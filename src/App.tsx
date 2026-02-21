import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TodayPage from "./pages/TodayPage";
import MealsPage from "./pages/MealsPage";
import RecipesPage from "./pages/RecipesPage";
import GroceryPage from "./pages/GroceryPage";
import ChoresPage from "./pages/ChoresPage";
import TasksPage from "./pages/TasksPage";
import MeDashboardPage from "./pages/MeDashboardPage";
import WifeDashboardPage from "./pages/WifeDashboardPage";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import BillingPage from "./pages/BillingPage";
import OnboardingPage from "./pages/OnboardingPage";
import FamilyPage from "./pages/FamilyPage";
import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireProfileComplete } from "./components/auth/RequireProfileComplete";
import { RequireSubscription } from "./components/auth/RequireSubscription";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
