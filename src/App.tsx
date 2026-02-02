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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TodayPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/chores" element={<ChoresPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/me" element={<MeDashboardPage />} />
          <Route path="/wife" element={<WifeDashboardPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
