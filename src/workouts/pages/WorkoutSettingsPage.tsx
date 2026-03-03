import { useState } from 'react';
import { Bell, Vibrate, Scale, Timer, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutsBottomNav } from '@/workouts/components/WorkoutsBottomNav';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { settings, updateSettings, workouts, templates } = useWorkoutStore();

  const handleExportData = () => {
    const data = {
      workouts,
      templates,
      settings,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liftlog-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearData = () => {
    if (confirm('This will delete ALL your workout data. This cannot be undone. Are you sure?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const restTimerOptions = [60, 90, 120, 150, 180, 240, 300];

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="px-4 pt-8 pb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your experience</p>
      </header>

      <div className="px-4 space-y-6">
        {/* Rest Timer */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Default Rest Timer</h3>
              <p className="text-sm text-muted-foreground">Time between sets</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {restTimerOptions.map(seconds => (
              <button
                key={seconds}
                onClick={() => updateSettings({ defaultRestTimer: seconds })}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  settings.defaultRestTimer === seconds
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
              </button>
            ))}
          </div>
        </div>

        {/* Weight Unit */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <Scale className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Weight Unit</h3>
              <p className="text-sm text-muted-foreground">Display preference</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(['lb', 'kg'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => updateSettings({ weightUnit: unit })}
                className={cn(
                  "flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                  settings.weightUnit === unit
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {unit === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-4">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Bell className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-medium text-foreground">Sound</p>
                <p className="text-sm text-muted-foreground">Play sound when timer ends</p>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className={cn(
                "w-12 h-7 rounded-full transition-colors relative",
                settings.soundEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 rounded-full bg-white transition-all",
                settings.soundEnabled ? "left-6" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Vibrate className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Vibration</p>
                <p className="text-sm text-muted-foreground">Vibrate when timer ends</p>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ vibrationEnabled: !settings.vibrationEnabled })}
              className={cn(
                "w-12 h-7 rounded-full transition-colors relative",
                settings.vibrationEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 rounded-full bg-white transition-all",
                settings.vibrationEnabled ? "left-6" : "left-1"
              )} />
            </button>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="font-semibold text-foreground">Data</h3>
          
          <Button variant="outline" className="w-full" onClick={handleExportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data (JSON)
          </Button>

          <Button 
            variant="ghost" 
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleClearData}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        </div>

        {/* Stats */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>{workouts.length} workouts • {templates.length} templates</p>
          <p className="mt-1">LiftLog v1.0</p>
        </div>
      </div>
      <WorkoutsBottomNav />
    </div>
  );
}
