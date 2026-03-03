import { BarChart3, Dumbbell, Home, LayoutTemplate, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const items = [
  { label: 'Home', path: '/workouts', icon: Home },
  { label: 'Workout', path: '/workouts/new', icon: Dumbbell },
  { label: 'Progress', path: '/workouts/progress', icon: BarChart3 },
  { label: 'Templates', path: '/workouts/templates', icon: LayoutTemplate },
  { label: 'Settings', path: '/workouts/settings', icon: Settings },
];

export function WorkoutsBottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/workouts') {
      return location.pathname === '/workouts';
    }
    if (path === '/workouts/new') {
      return location.pathname === '/workouts/new';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav className="fixed bottom-16 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          {items.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'flex min-w-[58px] flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] transition-colors',
                isActive(path) ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-4 w-4', isActive(path) && 'stroke-[2.5px]')} />
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <nav className="hidden md:block fixed bottom-4 left-[calc(50%+8rem)] -translate-x-1/2 z-40">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
          {items.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                isActive(path)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
