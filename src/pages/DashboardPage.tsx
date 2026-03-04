import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PersonNutritionDashboard } from '@/components/nutrition/PersonNutritionDashboard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { listDashboardProfiles } from '@/lib/macroGame';

export default function DashboardPage() {
  const { dashboardId = '' } = useParams();
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const onMacroStateUpdated = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener('homehub:macro-state-updated', onMacroStateUpdated);
    return () => window.removeEventListener('homehub:macro-state-updated', onMacroStateUpdated);
  }, []);

  const dashboards = useMemo(() => listDashboardProfiles(), [refreshTick]);
  const activeIndex = dashboards.findIndex((dashboard) => dashboard.id === dashboardId);

  if (activeIndex < 0) {
    return (
      <AppLayout>
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl">Dashboard not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This dashboard does not exist. Pick another one from the sidebar or go back to Today.
          </p>
          <Link to="/app">
            <Button className="mt-4">Back to Today</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const accent = activeIndex % 2 === 0 ? 'primary' : 'accent';
  return <PersonNutritionDashboard personId={dashboardId} accent={accent} />;
}
