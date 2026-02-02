import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockHouseTasks } from '@/data/mockData';
import { HouseTask, TaskStatus, DayOfWeek } from '@/types';
import { Plus, Circle, Clock, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

const statusOrder: TaskStatus[] = ['in_progress', 'not_started', 'done'];

const typeIcons = {
  do: AlertCircle,
  maintain: Clock,
  notice: Info,
};

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockHouseTasks);
  const [view, setView] = useState<'manager' | 'owner'>('manager');
  const currentDay = getCurrentDay();

  const cycleStatus = (taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      const currentIndex = statusOrder.indexOf(task.status);
      const nextIndex = (currentIndex + 1) % statusOrder.length;
      return { ...task, status: statusOrder[nextIndex] };
    }));
  };

  const todaysTasks = tasks.filter(task => 
    task.frequency === 'once' || task.day === currentDay
  );

  const thisWeeksTasks = tasks.filter(task => task.frequency !== 'once');
  const oneTimeTasks = tasks.filter(task => task.frequency === 'once');

  const sortedTodaysTasks = [...todaysTasks].sort((a, b) => {
    return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
  });

  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    pending: tasks.filter(t => t.status === 'not_started').length,
  };

  return (
    <AppLayout>
      <PageHeader 
        title="House Manager" 
        subtitle="Keep the house running smoothly"
        action={
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        }
      />

      {/* View Toggle */}
      <Tabs value={view} onValueChange={(v) => setView(v as 'manager' | 'owner')} className="mb-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manager">Manager View</TabsTrigger>
          <TabsTrigger value="owner">Owner View</TabsTrigger>
        </TabsList>

        <TabsContent value="manager" className="mt-6 space-y-6">
          {/* Today's Tasks */}
          <SectionCard title="Today" subtitle={`${sortedTodaysTasks.filter(t => t.status === 'done').length} of ${sortedTodaysTasks.length} complete`}>
            {sortedTodaysTasks.length > 0 ? (
              <div className="space-y-2">
                {sortedTodaysTasks.map(task => (
                  <TaskRow key={task.id} task={task} onStatusChange={cycleStatus} />
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-muted-foreground">Nothing for today</p>
            )}
          </SectionCard>

          {/* One-time Tasks */}
          <SectionCard title="One-Time Tasks" subtitle={`${oneTimeTasks.filter(t => t.status !== 'done').length} pending`}>
            {oneTimeTasks.length > 0 ? (
              <div className="space-y-2">
                {oneTimeTasks.map(task => (
                  <TaskRow key={task.id} task={task} onStatusChange={cycleStatus} />
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-muted-foreground">No one-time tasks</p>
            )}
          </SectionCard>

          {/* Recurring Tasks */}
          <SectionCard title="Weekly Schedule">
            <div className="space-y-2">
              {thisWeeksTasks.map(task => (
                <div 
                  key={task.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge type={task.type} />
                    <span className="text-sm">{task.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {task.day || task.frequency}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="owner" className="mt-6">
          {/* Owner Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Tasks" value={stats.total} />
            <StatCard label="Completed" value={stats.done} variant="success" />
            <StatCard label="In Progress" value={stats.inProgress} variant="warning" />
            <StatCard label="Pending" value={stats.pending} variant="muted" />
          </div>

          <SectionCard title="Overview">
            <p className="text-muted-foreground text-sm mb-4">
              High-level summary of house management status.
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="font-medium">Tasks Requiring Attention</span>
                <span className="text-2xl font-display font-semibold text-accent">
                  {stats.pending + stats.inProgress}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="font-medium">Completion Rate</span>
                <span className="text-2xl font-display font-semibold text-primary">
                  {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
                </span>
              </div>
              
              <div className="flex items-center justify-between py-3">
                <span className="font-medium">Active Notices</span>
                <span className="text-2xl font-display font-semibold">
                  {tasks.filter(t => t.type === 'notice' && t.status !== 'done').length}
                </span>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function TaskRow({ task, onStatusChange }: { task: HouseTask; onStatusChange: (id: string) => void }) {
  const TypeIcon = typeIcons[task.type];
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border transition-gentle cursor-pointer",
        "hover:bg-muted/50",
        task.status === 'done' && "bg-muted/30 opacity-60"
      )}
      onClick={() => task.type !== 'notice' && onStatusChange(task.id)}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {task.status === 'done' ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : task.status === 'in_progress' ? (
          <Clock className="w-5 h-5 text-warning" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-medium text-sm",
          task.status === 'done' && "line-through text-muted-foreground"
        )}>
          {task.title}
        </p>
        {task.notes && (
          <p className="text-xs text-muted-foreground truncate">{task.notes}</p>
        )}
      </div>

      {/* Type badge */}
      <StatusBadge type={task.type} />
    </div>
  );
}

function StatCard({ label, value, variant }: { label: string; value: number; variant?: 'success' | 'warning' | 'muted' }) {
  const colorClass = variant === 'success' 
    ? 'text-primary' 
    : variant === 'warning' 
      ? 'text-warning' 
      : variant === 'muted'
        ? 'text-muted-foreground'
        : 'text-foreground';
  
  return (
    <div className="bg-card rounded-xl border border-border p-4 text-center">
      <p className={cn("text-3xl font-display font-semibold", colorClass)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
