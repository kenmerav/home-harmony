import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { mockChildren } from '@/data/mockData';
import { Child, DayOfWeek, Chore, WeeklyChore } from '@/types';
import { Plus, RotateCcw, CheckCircle2, X } from 'lucide-react';
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

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

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

export default function ChoresPage() {
  const [children, setChildren] = useState(mockChildren);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addChoreOpen, setAddChoreOpen] = useState(false);
  const [choreChildId, setChoreChildId] = useState<string | null>(null);
  const [newChoreName, setNewChoreName] = useState('');
  const [newChoreType, setNewChoreType] = useState<'daily' | 'weekly'>('daily');
  const [newChoreDay, setNewChoreDay] = useState<DayOfWeek>('monday');
  const currentDay = getCurrentDay();
  const { toast } = useToast();

  const toggleDailyChore = (childId: string, choreId: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id !== childId) return child;
      return {
        ...child,
        dailyChores: child.dailyChores.map(chore =>
          chore.id === choreId ? { ...chore, isCompleted: !chore.isCompleted } : chore
        ),
      };
    }));
  };

  const toggleWeeklyChore = (childId: string, choreId: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id !== childId) return child;
      return {
        ...child,
        weeklyChores: child.weeklyChores.map(chore =>
          chore.id === choreId ? { ...chore, isCompleted: !chore.isCompleted } : chore
        ),
      };
    }));
  };

  const resetDaily = () => {
    setChildren(prev => prev.map(child => ({
      ...child,
      dailyChores: child.dailyChores.map(chore => ({ ...chore, isCompleted: false })),
    })));
    toast({
      title: "Daily chores reset",
      description: "All daily chores have been unchecked",
    });
  };

  const addChild = () => {
    if (!newChildName.trim()) return;
    
    const newChild: Child = {
      id: `child-${Date.now()}`,
      name: newChildName.trim(),
      dailyChores: [],
      weeklyChores: [],
    };
    
    setChildren(prev => [...prev, newChild]);
    setNewChildName('');
    setAddChildOpen(false);
    toast({
      title: "Child added",
      description: `${newChild.name} has been added`,
    });
  };

  const openAddChore = (childId: string) => {
    setChoreChildId(childId);
    setNewChoreName('');
    setNewChoreType('daily');
    setNewChoreDay('monday');
    setAddChoreOpen(true);
  };

  const addChore = () => {
    if (!newChoreName.trim() || !choreChildId) return;
    
    setChildren(prev => prev.map(child => {
      if (child.id !== choreChildId) return child;
      
      if (newChoreType === 'daily') {
        const newChore: Chore = {
          id: `chore-${Date.now()}`,
          name: newChoreName.trim(),
          isCompleted: false,
        };
        return { ...child, dailyChores: [...child.dailyChores, newChore] };
      } else {
        const newChore: WeeklyChore = {
          id: `chore-${Date.now()}`,
          name: newChoreName.trim(),
          day: newChoreDay,
          isCompleted: false,
        };
        return { ...child, weeklyChores: [...child.weeklyChores, newChore] };
      }
    }));
    
    setAddChoreOpen(false);
    toast({
      title: "Chore added",
      description: `"${newChoreName}" has been added`,
    });
  };

  const removeChild = (childId: string) => {
    setChildren(prev => prev.filter(c => c.id !== childId));
    toast({
      title: "Child removed",
    });
  };

  const totalDailyChores = children.reduce((sum, c) => sum + c.dailyChores.length, 0);
  const completedDailyChores = children.reduce(
    (sum, c) => sum + c.dailyChores.filter(ch => ch.isCompleted).length, 
    0
  );

  return (
    <AppLayout>
      <PageHeader 
        title="Kids Chores" 
        subtitle={`${completedDailyChores} of ${totalDailyChores} daily chores done`}
        action={
          <Button variant="outline" size="sm" onClick={resetDaily}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Daily
          </Button>
        }
      />

      <div className="space-y-6">
        {children.map(child => {
          const dailyCompleted = child.dailyChores.filter(c => c.isCompleted).length;
          const dailyTotal = child.dailyChores.length;
          const todaysWeekly = child.weeklyChores.filter(c => c.day === currentDay);
          
          return (
            <SectionCard 
              key={child.id} 
              title={child.name}
              subtitle={dailyTotal > 0 ? `${dailyCompleted}/${dailyTotal} daily chores complete` : 'No chores yet'}
              action={
                <Button variant="ghost" size="sm" onClick={() => removeChild(child.id)}>
                  <X className="w-4 h-4" />
                </Button>
              }
            >
              <div className="space-y-4">
                {/* Daily Chores */}
                {child.dailyChores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Daily</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {child.dailyChores.map(chore => (
                        <label 
                          key={chore.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-gentle",
                            "hover:bg-muted/50",
                            chore.isCompleted && "bg-primary/5 border-primary/20"
                          )}
                        >
                          <Checkbox 
                            checked={chore.isCompleted}
                            onCheckedChange={() => toggleDailyChore(child.id, chore.id)}
                          />
                          <span className={cn(
                            "flex-1 text-sm",
                            chore.isCompleted && "line-through text-muted-foreground"
                          )}>
                            {chore.name}
                          </span>
                          {chore.isCompleted && (
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Today's Weekly Chores */}
                {todaysWeekly.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Today's Weekly Chore
                    </h4>
                    <div className="space-y-2">
                      {todaysWeekly.map(chore => (
                        <label 
                          key={chore.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 cursor-pointer transition-gentle",
                            "hover:bg-primary/5",
                            chore.isCompleted && "bg-primary/10 border-primary/40"
                          )}
                        >
                          <Checkbox 
                            checked={chore.isCompleted}
                            onCheckedChange={() => toggleWeeklyChore(child.id, chore.id)}
                          />
                          <span className={cn(
                            "flex-1",
                            chore.isCompleted && "line-through text-muted-foreground"
                          )}>
                            {chore.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Weekly Chores */}
                {child.weeklyChores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Weekly Schedule</h4>
                    <div className="flex flex-wrap gap-2">
                      {child.weeklyChores.map(chore => (
                        <div 
                          key={chore.id}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs",
                            chore.day === currentDay
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {dayLabels[chore.day].slice(0, 3)}: {chore.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Chore Button */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full"
                  onClick={() => openAddChore(child.id)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chore
                </Button>
              </div>
            </SectionCard>
          );
        })}
      </div>

      {/* Add Child Button */}
      <Button 
        variant="outline" 
        className="w-full mt-6"
        onClick={() => setAddChildOpen(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Child
      </Button>

      {/* Add Child Dialog */}
      <Dialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Child</DialogTitle>
            <DialogDescription>
              Add a new child to track their chores
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Child's name"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChild()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddChildOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addChild} disabled={!newChildName.trim()}>
                Add Child
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Chore Dialog */}
      <Dialog open={addChoreOpen} onOpenChange={setAddChoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Chore</DialogTitle>
            <DialogDescription>
              Add a new chore for {children.find(c => c.id === choreChildId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Chore name"
              value={newChoreName}
              onChange={(e) => setNewChoreName(e.target.value)}
            />
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={newChoreType} onValueChange={(v) => setNewChoreType(v as 'daily' | 'weekly')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (resets every day)</SelectItem>
                  <SelectItem value="weekly">Weekly (specific day)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newChoreType === 'weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of Week</label>
                <Select value={newChoreDay} onValueChange={(v) => setNewChoreDay(v as DayOfWeek)}>
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
              <Button variant="outline" onClick={() => setAddChoreOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addChore} disabled={!newChoreName.trim()}>
                Add Chore
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
