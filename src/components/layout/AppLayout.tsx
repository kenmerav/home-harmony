import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Calendar,
  CalendarDays, 
  BookOpen, 
  ShoppingCart, 
  Dumbbell,
  ListChecks, 
  ClipboardList,
  UserRoundPlus,
  Compass,
  Shield,
  Settings,
  LogOut,
  User,
  Plus,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { addDashboardProfile, listDashboardProfiles, renameDashboardProfile } from '@/lib/macroGame';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AppLayoutProps {
  children: ReactNode;
  contentWidthClassName?: string;
}

const navItems = [
  { to: '/app', icon: Home, label: 'Today' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/meals', icon: CalendarDays, label: 'Meals' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/grocery', icon: ShoppingCart, label: 'Grocery' },
  { to: '/workouts', icon: Dumbbell, label: 'Workouts' },
  { to: '/chores', icon: ListChecks, label: 'Chores' },
  { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/family', icon: UserRoundPlus, label: 'Family' },
  { to: '/getting-started', icon: Compass, label: 'Start Here' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const adminNavItem = { to: '/admin', icon: Shield, label: 'Admin' };

export function AppLayout({ children, contentWidthClassName }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;
  const [dashboards, setDashboards] = useState(() => listDashboardProfiles());
  const [mobileDashboardsOpen, setMobileDashboardsOpen] = useState(false);

  const refreshDashboards = () => setDashboards(listDashboardProfiles());

  useEffect(() => {
    refreshDashboards();
    const onMacroStateUpdated = () => refreshDashboards();
    window.addEventListener('homehub:macro-state-updated', onMacroStateUpdated);
    return () => window.removeEventListener('homehub:macro-state-updated', onMacroStateUpdated);
  }, []);

  const activeDashboardId = useMemo(() => {
    const match = location.pathname.match(/^\/dashboard\/([^/]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
    if (location.pathname === '/me') return 'me';
    if (location.pathname === '/wife') return 'wife';
    return null;
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  const handleAddDashboard = () => {
    const raw = window.prompt('Name this dashboard', 'New Dashboard');
    if (!raw || !raw.trim()) return;
    const created = addDashboardProfile(raw);
    refreshDashboards();
    navigate(`/dashboard/${created.id}`);
  };

  const handleRenameDashboard = (dashboardId: string, currentName: string) => {
    const raw = window.prompt('Rename dashboard', currentName);
    if (!raw || !raw.trim()) return;
    renameDashboardProfile(dashboardId, raw);
    refreshDashboards();
  };

  const handleOpenDashboard = (dashboardId: string) => {
    navigate(`/dashboard/${dashboardId}`);
    setMobileDashboardsOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="pb-20 md:pb-6 md:pl-64">
        <div className={cn(contentWidthClassName || "max-w-4xl", "mx-auto p-4 md:p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileDashboardsOpen(true)}
            >
              <User className="w-4 h-4 mr-2" />
              Dashboards
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
          {children}
        </div>
      </main>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col border-r border-border bg-sidebar">
        <div className="p-6">
          <h1 className="font-display text-xl font-semibold text-sidebar-foreground">
            Home Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Family management</p>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-gentle",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
          
          <div className="pt-4 pb-2 px-3 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dashboards
            </p>
            <button
              type="button"
              onClick={handleAddDashboard}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Add dashboard"
              title="Add dashboard"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          {dashboards.map((dashboard) => {
            const to = `/dashboard/${dashboard.id}`;
            const isActive = activeDashboardId === dashboard.id;
            return (
              <div key={dashboard.id} className="group flex items-center gap-1">
                <NavLink
                  to={to}
                  className={cn(
                    "flex flex-1 items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-gentle",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <User className="w-5 h-5" />
                  {dashboard.name}
                </NavLink>
                <button
                  type="button"
                  onClick={() => handleRenameDashboard(dashboard.id, dashboard.name)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label={`Rename ${dashboard.name}`}
                  title={`Rename ${dashboard.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-inset-bottom">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          {visibleNavItems.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-gentle min-w-[64px] shrink-0",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      <Dialog open={mobileDashboardsOpen} onOpenChange={setMobileDashboardsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Dashboards</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {dashboards.map((dashboard) => {
              const isActive = activeDashboardId === dashboard.id;
              return (
                <div key={dashboard.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDashboard(dashboard.id)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-2 text-left text-sm',
                      isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground',
                    )}
                  >
                    {dashboard.name}
                  </button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRenameDashboard(dashboard.id, dashboard.name)}
                    aria-label={`Rename ${dashboard.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={handleAddDashboard}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
