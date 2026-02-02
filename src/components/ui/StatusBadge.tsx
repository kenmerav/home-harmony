import { cn } from '@/lib/utils';
import { TaskStatus, TaskType } from '@/types';

interface StatusBadgeProps {
  status?: TaskStatus;
  type?: TaskType;
}

const statusStyles: Record<TaskStatus, string> = {
  done: 'bg-primary/10 text-primary',
  in_progress: 'bg-warning/10 text-warning',
  not_started: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<TaskStatus, string> = {
  done: 'Done',
  in_progress: 'In Progress',
  not_started: 'Not Started',
};

const typeStyles: Record<TaskType, string> = {
  do: 'bg-accent/10 text-accent',
  maintain: 'bg-primary/10 text-primary',
  notice: 'bg-info/10 text-info',
};

const typeLabels: Record<TaskType, string> = {
  do: 'Do',
  maintain: 'Maintain',
  notice: 'Notice',
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  if (status) {
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusStyles[status])}>
        {statusLabels[status]}
      </span>
    );
  }

  if (type) {
    return (
      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", typeStyles[type])}>
        {typeLabels[type]}
      </span>
    );
  }

  return null;
}
