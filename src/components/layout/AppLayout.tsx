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
  Pencil,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { listDashboardProfiles, renameDashboardProfile } from '@/lib/macroGame';
import { LocalFamilyMemberDialog } from '@/components/family/LocalFamilyMemberDialog';
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
  const { signOut, isAdmin, user, profile } = useAuth();
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;
  const [dashboards, setDashboards] = useState(() => listDashboardProfiles());
  const [mobileDashboardsOpen, setMobileDashboardsOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [familySetupOpen, setFamilySetupOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('homehub:sidebar-collapsed') === '1';
  });

  const refreshDashboards = () => setDashboards(listDashboardProfiles());

  useEffect(() => {
    refreshDashboards();
    const onMacroStateUpdated = () => refreshDashboards();
    window.addEventListener('homehub:macro-state-updated', onMacroStateUpdated);
    return () => window.removeEventListener('homehub:macro-state-updated', onMacroStateUpdated);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('homehub:sidebar-collapsed', isSidebarCollapsed ? '1' : '0');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const key = `homehub.family-setup-prompt.v1:${user.id}`;
    const seen = window.localStorage.getItem(key) === '1';
    if (!seen) {
      setFamilySetupOpen(true);
    }
  }, [user?.id]);

  const activeDashboardId = useMemo(() => {
    const match = location.pathname.match(/^\/dashboard\/([^/]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
    if (location.pathname === '/me') return 'me';
    if (location.pathname === '/wife') return 'wife';
    return null;
  }, [location.pathname]);

  const mobilePrimaryNavItems = useMemo(
    () =>
      visibleNavItems.filter((item) =>
        ['/app', '/calendar', '/meals', '/grocery'].includes(item.to),
      ),
    [visibleNavItems],
  );

  const mobileOverflowNavItems = useMemo(
    () => visibleNavItems.filter((item) => !mobilePrimaryNavItems.some((primary) => primary.to === item.to)),
    [mobilePrimaryNavItems, visibleNavItems],
  );

  const isMobileMoreActive = useMemo(
    () => mobileOverflowNavItems.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)),
    [location.pathname, mobileOverflowNavItems],
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  const handleAddDashboard = () => {
    setMemberDialogOpen(true);
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

  const closeFamilySetup = () => {
    if (user?.id && typeof window !== 'undefined') {
      window.localStorage.setItem(`homehub.family-setup-prompt.v1:${user.id}`, '1');
    }
    setFamilySetupOpen(false);
  };

  const openFamilySetupPath = (path: string) => {
    closeFamilySetup();
    navigate(path);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Main Content */}
      <main
        className={cn(
          'pb-20 md:pb-6 transition-[padding-left] duration-200',
          isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64',
        )}
      >
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
      <aside
        className={cn(
          'hidden md:flex fixed left-0 top-0 h-full flex-col border-r border-border bg-sidebar transition-[width] duration-200',
          isSidebarCollapsed ? 'w-20' : 'w-64',
        )}
      >
        <div className={cn('p-4 flex items-start', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
          <div className={cn(isSidebarCollapsed ? 'hidden' : 'block')}>
            <h1 className="font-display text-xl font-semibold text-sidebar-foreground">
              Home Harmony
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Family management</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
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
                  "flex items-center rounded-lg text-sm font-medium transition-gentle",
                  isSidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                  isActive 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5" />
                {!isSidebarCollapsed && item.label}
              </NavLink>
            );
          })}
          
          <div className={cn('pt-4 pb-2 flex items-center', isSidebarCollapsed ? 'justify-center px-0' : 'justify-between px-3')}>
            {!isSidebarCollapsed && (
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Adult Dashboards
              </p>
            )}
            <button
              type="button"
              onClick={handleAddDashboard}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Add family member"
              title="Add family member"
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
                    "flex flex-1 items-center rounded-lg text-sm font-medium transition-gentle",
                    isSidebarCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  title={isSidebarCollapsed ? dashboard.name : undefined}
                >
                  <User className="w-5 h-5" />
                  {!isSidebarCollapsed && dashboard.name}
                </NavLink>
                {!isSidebarCollapsed && (
                  <button
                    type="button"
                    onClick={() => handleRenameDashboard(dashboard.id, dashboard.name)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    aria-label={`Rename ${dashboard.name}`}
                    title={`Rename ${dashboard.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-inset-bottom">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {mobilePrimaryNavItems.map((item) => {
            const isActive =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-gentle",
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
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 transition-gentle",
              isMobileMoreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className={cn("w-5 h-5", isMobileMoreActive && "stroke-[2.5px]")} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Dialog open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">More</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            {mobileOverflowNavItems.map((item) => {
              const isActive =
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <button
                  key={`mobile-more-${item.to}`}
                  type="button"
                  onClick={() => {
                    navigate(item.to);
                    setMobileMoreOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-gentle",
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted/40",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mobileDashboardsOpen} onOpenChange={setMobileDashboardsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Adult Dashboards</DialogTitle>
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
              Add Adult or Child
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={familySetupOpen} onOpenChange={(open) => !open && closeFamilySetup()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Set up your family workspace</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {`Welcome${profile?.fullName ? `, ${profile.fullName}` : ''}.`} Do this once so meals, chores, tasks, and reminders are shared correctly.
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => openFamilySetupPath('/family?role=spouse')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted/40"
            >
              Invite spouse/partner
            </button>
            <button
              type="button"
              onClick={() => openFamilySetupPath('/family?role=kid')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted/40"
            >
              Invite kids
            </button>
            <button
              type="button"
              onClick={() => openFamilySetupPath('/family?role=kid')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted/40"
            >
              Set up adults and kids locally
            </button>
            <button
              type="button"
              onClick={() => openFamilySetupPath('/recipes')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm hover:bg-muted/40"
            >
              Add recipes to start planning
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => openFamilySetupPath('/getting-started')}>
              Full setup guide
            </Button>
            <Button onClick={closeFamilySetup}>I&apos;ll do this later</Button>
          </div>
        </DialogContent>
      </Dialog>

      <LocalFamilyMemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        userId={user?.id}
        onCreated={(member) => {
          refreshDashboards();
          if (member.memberType === 'adult') {
            navigate(`/dashboard/${member.id}`);
            setMobileDashboardsOpen(false);
            return;
          }
          navigate('/chores');
        }}
      />
    </div>
  );
}
