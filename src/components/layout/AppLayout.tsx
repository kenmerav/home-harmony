import { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  CalendarDays, 
  BookOpen, 
  ShoppingCart, 
  ListChecks, 
  ClipboardList,
  UserRoundPlus,
  LogOut,
  User,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/app', icon: Home, label: 'Today' },
  { to: '/meals', icon: CalendarDays, label: 'Meals' },
  { to: '/recipes', icon: BookOpen, label: 'Recipes' },
  { to: '/grocery', icon: ShoppingCart, label: 'Grocery' },
  { to: '/chores', icon: ListChecks, label: 'Chores' },
  { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
  { to: '/family', icon: UserRoundPlus, label: 'Family' },
];

const profileItems = [
  { to: '/me', icon: User, label: 'Me' },
  { to: '/wife', icon: Users, label: 'Wife' },
];

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <main className="pb-20 md:pb-6 md:pl-64">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <div className="mb-4 flex justify-end">
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
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
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
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dashboards
            </p>
          </div>
          
          {profileItems.map((item) => {
            const isActive = location.pathname === item.to;
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
        </nav>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-inset-bottom">
        <div className="flex items-center gap-1 overflow-x-auto px-2 py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
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
    </div>
  );
}
