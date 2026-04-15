import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HouseTask, TaskStatus, TaskType, TaskFrequency, DayOfWeek } from '@/types';
import { Plus, Circle, Clock, CheckCircle2, AlertCircle, Info, Trash2, Pencil } from 'lucide-react';
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
import { loadTasks, saveTasks, taskOccursOnDate, taskFrequencyLabel } from '@/lib/taskStore';
import { useAuth } from '@/contexts/AuthContext';
import { syncDerivedCalendarSnapshot } from '@/lib/calendarFeed';
import { listDashboardProfiles } from '@/lib/macroGame';
import { getHouseholdDashboard } from '@/lib/api/family';

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

type TaskDraft = {
  title: string;
  notes: string;
  type: TaskType;
  frequency: TaskFrequency;
  assignedToId: string;
  day: DayOfWeek;
  dueDate: string;
  reminderEnabled: boolean;
  reminderTime: string;
};

const DEFAULT_TASK_DRAFT: TaskDraft = {
  title: '',
  notes: '',
  type: 'do',
  frequency: 'once',
  assignedToId: 'unassigned',
  day: 'monday',
  dueDate: '',
  reminderEnabled: false,
  reminderTime: '09:00',
};

export default function TasksPage() {
  const { user, profile, sharedHouseholdOwnerId } = useAuth();
  const [tasks, setTasks] = useState<HouseTask[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [view, setView] = useState<'manager' | 'owner'>('manager');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState<TaskDraft>(DEFAULT_TASK_DRAFT);
  const [editTask, setEditTask] = useState<TaskDraft>(DEFAULT_TASK_DRAFT);
  const [adultDashboards, setAdultDashboards] = useState(() => listDashboardProfiles());
  const [memberNameByUserId, setMemberNameByUserId] = useState<Map<string, string>>(new Map());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { toast } = useToast();

  useEffect(() => {
    setTasks(loadTasks(user?.id));
    setTasksLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (!tasksLoaded) return;
    saveTasks(tasks, user?.id);
  }, [tasks, tasksLoaded, user?.id]);

  useEffect(() => {
    if (!tasksLoaded) return;
    void syncDerivedCalendarSnapshot(user?.id, new Date());
  }, [tasks, tasksLoaded, user?.id]);

  useEffect(() => {
    const refreshDashboards = () => setAdultDashboards(listDashboardProfiles());
    window.addEventListener('homehub:macro-state-updated', refreshDashboards);
    return () => window.removeEventListener('homehub:macro-state-updated', refreshDashboards);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setMemberNameByUserId(new Map());
      return;
    }

    let cancelled = false;

    const loadMemberNames = async () => {
      try {
        const household = await getHouseholdDashboard();
        if (cancelled) return;

        const nextMap = new Map<string, string>();
        (household.members || [])
          .filter((member) => member.status === 'active')
          .forEach((member) => {
            const fullName = member.full_name?.trim();
            if (member.user_id && fullName) {
              nextMap.set(member.user_id, fullName);
            }
          });

        const ownFullName = profile?.fullName?.trim();
        if (ownFullName) {
          nextMap.set(user.id, ownFullName);
        }

        setMemberNameByUserId(nextMap);
      } catch (error) {
        if (cancelled) return;
        const fallbackMap = new Map<string, string>();
        const ownFullName = profile?.fullName?.trim();
        if (ownFullName) {
          fallbackMap.set(user.id, ownFullName);
        }
        setMemberNameByUserId(fallbackMap);
        console.error('Failed to load household member names for tasks:', error);
      }
    };

    void loadMemberNames();
    return () => {
      cancelled = true;
    };
  }, [profile?.fullName, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refreshTasks = () => {
      setTasks((current) => {
        const next = loadTasks(user?.id);
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
    };
    window.addEventListener('homehub:task-state-updated', refreshTasks);
    return () => window.removeEventListener('homehub:task-state-updated', refreshTasks);
  }, [user?.id]);

  const dashboardNameById = useMemo(
    () => new Map(adultDashboards.map((dashboard) => [dashboard.id, dashboard.name])),
    [adultDashboards],
  );
  const assignableAdults = useMemo(() => {
    const options = new Map<string, string>();
    options.set('me', 'Me');

    adultDashboards
      .filter((dashboard) => dashboard.memberType === 'adult')
      .forEach((dashboard) => {
        options.set(dashboard.id, dashboard.id === 'me' ? 'Me' : dashboard.name);
      });

    memberNameByUserId.forEach((fullName, userId) => {
      if (!userId || userId === user?.id) return;
      if (!options.has(userId)) {
        options.set(userId, fullName);
      }
    });

    return Array.from(options.entries()).map(([id, label]) => ({ id, label }));
  }, [adultDashboards, memberNameByUserId, user?.id]);

  const resolveAssigneeLabel = (assignedToId?: string, assignedToName?: string) => {
    const normalizedId = assignedToId?.trim();
    const cleanedFallback = assignedToName?.trim();

    if (!normalizedId) {
      return cleanedFallback || undefined;
    }

    if (normalizedId === 'me' || (user?.id && normalizedId === user.id)) {
      return 'Me';
    }

    const memberName = memberNameByUserId.get(normalizedId);
    if (memberName) {
      return memberName;
    }

    const dashboardName = dashboardNameById.get(normalizedId);
    if (dashboardName && dashboardName.trim().toLowerCase() !== 'me') {
      return dashboardName;
    }

    if (cleanedFallback && cleanedFallback.toLowerCase() !== 'me') {
      return cleanedFallback;
    }

    if (sharedHouseholdOwnerId && normalizedId === sharedHouseholdOwnerId && normalizedId !== user?.id) {
      return memberNameByUserId.get(sharedHouseholdOwnerId) || 'Owner';
    }

    return cleanedFallback || undefined;
  };

  const taskAssigneeLabel = (task: HouseTask) => resolveAssigneeLabel(task.assignedToId, task.assignedToName);

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

  const draftFromTask = (task: HouseTask): TaskDraft => ({
    title: task.title,
    notes: task.notes || '',
    type: task.type,
    frequency: task.frequency,
    assignedToId: task.assignedToId || 'unassigned',
    day: task.day || 'monday',
    dueDate: task.dueDate || '',
    reminderEnabled: !!task.reminderEnabled,
    reminderTime: task.reminderTime || '09:00',
  });

  const taskFromDraft = (draft: TaskDraft, taskId?: string): HouseTask => {
    const dueDate = draft.dueDate.trim();
    const assignedToId = draft.assignedToId !== 'unassigned' ? draft.assignedToId : undefined;
    const assignedToName = assignedToId
      ? (() => {
          const resolved = resolveAssigneeLabel(assignedToId);
          if (resolved && resolved !== 'Me') return resolved;
          if (assignedToId === 'me' || assignedToId === user?.id) {
            return profile?.fullName?.trim() || memberNameByUserId.get(user?.id || '') || resolved || 'Me';
          }
          return dashboardNameById.get(assignedToId) || memberNameByUserId.get(assignedToId) || resolved;
        })()
      : undefined;
    return {
      id: taskId || `task-${Date.now()}`,
      title: draft.title.trim(),
      notes: draft.notes.trim() || undefined,
      type: draft.type,
      status: 'not_started',
      frequency: draft.frequency,
      assignedToId,
      assignedToName,
      day: draft.frequency === 'weekly' ? draft.day : undefined,
      dueDate: dueDate || undefined,
      reminderEnabled: draft.reminderEnabled,
      reminderTime: draft.reminderEnabled ? draft.reminderTime : undefined,
      createdAt: new Date(),
    };
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    if (newTask.frequency === 'once' && !newTask.dueDate) {
      toast({ title: 'Pick a due date', variant: 'destructive' });
      return;
    }
    const task = taskFromDraft(newTask);
    setTasks(prev => [...prev, task]);
    setAddTaskOpen(false);
    setNewTask(DEFAULT_TASK_DRAFT);
    toast({
      title: "Task added",
      description: `"${task.title}" has been added`,
    });
  };

  const openEditTask = (task: HouseTask) => {
    setEditingTaskId(task.id);
    setEditTask(draftFromTask(task));
    setEditTaskOpen(true);
  };

  const saveEditedTask = () => {
    if (!editingTaskId || !editTask.title.trim()) return;
    if (editTask.frequency === 'once' && !editTask.dueDate) {
      toast({ title: 'Pick a due date', variant: 'destructive' });
      return;
    }
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== editingTaskId) return task;
        const next = taskFromDraft(editTask, task.id);
        return {
          ...task,
          ...next,
          status: task.status,
          createdAt: task.createdAt,
        };
      }),
    );
    setEditTaskOpen(false);
    setEditingTaskId(null);
    toast({ title: 'Task updated' });
  };

  const todaysTasks = tasks.filter((task) => taskOccursOnDate(task, today));

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
                  <TaskRow
                    key={task.id}
                    task={task}
                    onStatusChange={cycleStatus}
                    onDelete={deleteTask}
                    onEdit={openEditTask}
                    assigneeLabel={taskAssigneeLabel(task)}
                  />
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
                  <TaskRow
                    key={task.id}
                    task={task}
                    onStatusChange={cycleStatus}
                    onDelete={deleteTask}
                    onEdit={openEditTask}
                    assigneeLabel={taskAssigneeLabel(task)}
                  />
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
                      <div className="min-w-0">
                        <p className="text-sm">{task.title}</p>
                        {taskAssigneeLabel(task) && (
                          <p className="text-xs text-muted-foreground">
                            Assigned to {taskAssigneeLabel(task)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground capitalize">
                        {taskFrequencyLabel(task)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEditTask(task)}
                        title="Edit task"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
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
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="every_3_months">Every 3 months</SelectItem>
                    <SelectItem value="every_6_months">Every 6 months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to adult</label>
              <Select
                value={newTask.assignedToId}
                onValueChange={(value) => setNewTask((prev) => ({ ...prev, assignedToId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No one specific</SelectItem>
                  {assignableAdults.map((adult) => (
                    <SelectItem key={adult.id} value={adult.id}>
                      {adult.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {newTask.frequency === 'once' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Due date</label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            )}

            {newTask.frequency !== 'once' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Start date (optional)</label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            )}

            <label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <Checkbox
                checked={newTask.reminderEnabled}
                onCheckedChange={(checked) =>
                  setNewTask((prev) => ({ ...prev, reminderEnabled: checked === true }))
                }
              />
              Enable reminder
            </label>

            {newTask.reminderEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Reminder time</label>
                <Input
                  type="time"
                  value={newTask.reminderTime}
                  onChange={(e) => setNewTask((prev) => ({ ...prev, reminderTime: e.target.value }))}
                />
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

      <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Task</DialogTitle>
            <DialogDescription>Update title, schedule, and reminders.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Task title"
              value={editTask.title}
              onChange={(e) => setEditTask((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Textarea
              placeholder="Notes (optional)"
              value={editTask.notes}
              onChange={(e) => setEditTask((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={editTask.type}
                  onValueChange={(v) => setEditTask((prev) => ({ ...prev, type: v as TaskType }))}
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
                  value={editTask.frequency}
                  onValueChange={(v) => setEditTask((prev) => ({ ...prev, frequency: v as TaskFrequency }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="every_3_months">Every 3 months</SelectItem>
                    <SelectItem value="every_6_months">Every 6 months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to adult</label>
              <Select
                value={editTask.assignedToId}
                onValueChange={(value) => setEditTask((prev) => ({ ...prev, assignedToId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No one specific</SelectItem>
                  {assignableAdults.map((adult) => (
                    <SelectItem key={adult.id} value={adult.id}>
                      {adult.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editTask.frequency === 'weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of week</label>
                <Select
                  value={editTask.day}
                  onValueChange={(v) => setEditTask((prev) => ({ ...prev, day: v as DayOfWeek }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allDays.map((day) => (
                      <SelectItem key={day} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editTask.frequency === 'once' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Due date</label>
                <Input
                  type="date"
                  value={editTask.dueDate}
                  onChange={(e) => setEditTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            )}
            {editTask.frequency !== 'once' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Start date (optional)</label>
                <Input
                  type="date"
                  value={editTask.dueDate}
                  onChange={(e) => setEditTask((prev) => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            )}
            <label className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <Checkbox
                checked={editTask.reminderEnabled}
                onCheckedChange={(checked) =>
                  setEditTask((prev) => ({ ...prev, reminderEnabled: checked === true }))
                }
              />
              Enable reminder
            </label>
            {editTask.reminderEnabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Reminder time</label>
                <Input
                  type="time"
                  value={editTask.reminderTime}
                  onChange={(e) => setEditTask((prev) => ({ ...prev, reminderTime: e.target.value }))}
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditTaskOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveEditedTask} disabled={!editTask.title.trim()}>
                Save
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
  onDelete,
  onEdit,
  assigneeLabel,
}: { 
  task: HouseTask; 
  onStatusChange: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: HouseTask) => void;
  assigneeLabel?: string;
}) {
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
        <p className="text-[11px] text-muted-foreground">
          {taskFrequencyLabel(task)}
          {task.reminderEnabled && task.reminderTime ? ` • Remind at ${task.reminderTime}` : ''}
        </p>
        {assigneeLabel && (
          <p className="text-[11px] text-muted-foreground">Assigned to {assigneeLabel}</p>
        )}
      </div>

      {/* Type badge */}
      <StatusBadge type={task.type} />

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 flex-shrink-0"
        onClick={() => onEdit(task)}
        title="Edit task"
      >
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </Button>
      
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
