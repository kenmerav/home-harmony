import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseTask, TaskStatus, TaskType, TaskFrequency, DayOfWeek } from '@/types';
import { Plus, Circle, Clock, CheckCircle2, AlertCircle, Info, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { loadTasks, saveTasks } from '@/lib/taskStore';
import { useAuth } from '@/contexts/AuthContext';

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

const statusOrder: TaskStatus[] = ['in_progress', 'not_started', 'done'];

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const typeIcons = {
  do: AlertCircle,
  maintain: Clock,
  notice: Info,
};

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HouseTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [view, setView] = useState<'manager' | 'owner'>('manager');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    notes: '',
    type: 'do' as TaskType,
    frequency: 'once' as TaskFrequency,
    day: 'monday' as DayOfWeek,
  });
  const currentDay = getCurrentDay();
  const { toast } = useToast();

  useEffect(() => {
    setTasks(loadTasks(user?.id));
    setTasksLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (!tasksLoaded) return;
    saveTasks(tasks, user?.id);
  }, [tasks, tasksLoaded, user?.id]);

  const cycleStatus = (taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;
      const currentIndex = statusOrder.indexOf(task.status);
      const nextIndex = (currentIndex + 1) % statusOrder.length;
      return { ...task, status: statusOrder[nextIndex] };
    }));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    toast({ title: "Task deleted" });
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    
    const task: HouseTask = {
      id: `task-${Date.now()}`,
      title: newTask.title.trim(),
      notes: newTask.notes.trim() || undefined,
      type: newTask.type,
      status: 'not_started',
      frequency: newTask.frequency,
      day: newTask.frequency !== 'once' ? newTask.day : undefined,
      createdAt: new Date(),
    };
    
    setTasks(prev => [...prev, task]);
    setAddTaskOpen(false);
    setNewTask({
      title: '',
      notes: '',
      type: 'do',
      frequency: 'once',
      day: 'monday',
    });
    toast({
      title: "Task added",
      description: `"${task.title}" has been added`,
    });
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
          <Button size="sm" onClick={() => setAddTaskOpen(true)}>
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
                  <TaskRow key={task.id} task={task} onStatusChange={cycleStatus} onDelete={deleteTask} />
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
                  <TaskRow key={task.id} task={task} onStatusChange={cycleStatus} onDelete={deleteTask} />
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-muted-foreground">No one-time tasks</p>
            )}
          </SectionCard>

          {/* Recurring Tasks */}
          <SectionCard title="Weekly Schedule">
            {thisWeeksTasks.length > 0 ? (
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">
                        {task.day || task.frequency}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-6 text-muted-foreground">No recurring tasks</p>
            )}
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

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Task</DialogTitle>
            <DialogDescription>
              Create a new task for house management
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Task title"
              value={newTask.title}
              onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
            />
            
            <Textarea
              placeholder="Notes (optional)"
              value={newTask.notes}
              onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select 
                  value={newTask.type} 
                  onValueChange={(v) => setNewTask(prev => ({ ...prev, type: v as TaskType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="do">Do (action required)</SelectItem>
                    <SelectItem value="maintain">Maintain (recurring)</SelectItem>
                    <SelectItem value="notice">Notice (info only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency</label>
                <Select 
                  value={newTask.frequency} 
                  onValueChange={(v) => setNewTask(prev => ({ ...prev, frequency: v as TaskFrequency }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newTask.frequency === 'weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of Week</label>
                <Select 
                  value={newTask.day} 
                  onValueChange={(v) => setNewTask(prev => ({ ...prev, day: v as DayOfWeek }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allDays.map(day => (
                      <SelectItem key={day} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddTaskOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addTask} disabled={!newTask.title.trim()}>
                Add Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function TaskRow({ 
  task, 
  onStatusChange, 
  onDelete 
}: { 
  task: HouseTask; 
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const TypeIcon = typeIcons[task.type];
  
  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border transition-gentle",
        "hover:bg-muted/50",
        task.status === 'done' && "bg-muted/30 opacity-60"
      )}
    >
      {/* Status indicator - clickable */}
      <button 
        className="flex-shrink-0"
        onClick={() => task.type !== 'notice' && onStatusChange(task.id)}
      >
        {task.status === 'done' ? (
          <CheckCircle2 className="w-5 h-5 text-primary" />
        ) : task.status === 'in_progress' ? (
          <Clock className="w-5 h-5 text-warning" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

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
      
      {/* Delete button */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-6 w-6 flex-shrink-0"
        onClick={() => onDelete(task.id)}
      >
        <Trash2 className="w-3 h-3 text-muted-foreground" />
      </Button>
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
