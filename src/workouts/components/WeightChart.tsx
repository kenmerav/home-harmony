import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WeightLog } from '@/workouts/types/workout';

interface WeightChartProps {
  weightLogs: WeightLog[];
  weightUnit: 'lb' | 'kg';
}

export function WeightChart({ weightLogs, weightUnit }: WeightChartProps) {
  const chartData = useMemo(() => {
    // Get all unique dates and sort them
    const dateMap = new Map<string, { morning?: number; evening?: number }>();
    
    weightLogs.forEach(log => {
      const existing = dateMap.get(log.date) || {};
      // Handle legacy logs without timeOfDay - default to morning
      const time = log.timeOfDay || 'morning';
      existing[time] = log.weight;
      dateMap.set(log.date, existing);
    });

    return Array.from(dateMap.entries())
      .sort((a, b) => new Date(`${a[0]}T00:00:00`).getTime() - new Date(`${b[0]}T00:00:00`).getTime())
      .map(([date, weights]) => ({
        date: new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        morning: weights.morning,
        evening: weights.evening,
        fullDate: date,
      }));
  }, [weightLogs]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No weight data yet
      </div>
    );
  }

  const allWeights = chartData.flatMap(d => [d.morning, d.evening].filter((w): w is number => w !== undefined));
  const minWeight = Math.min(...allWeights);
  const maxWeight = Math.max(...allWeights);
  const padding = (maxWeight - minWeight) * 0.1 || 5;

  const hasMorning = chartData.some(d => d.morning !== undefined);
  const hasEvening = chartData.some(d => d.evening !== undefined);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
        />
        <YAxis 
          domain={[Math.floor(minWeight - padding), Math.ceil(maxWeight + padding)]}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '14px',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number, name: string) => [
            `${value} ${weightUnit}`, 
            name === 'morning' ? '☀️ Morning' : '🌙 Evening'
          ]}
        />
        {(hasMorning || hasEvening) && (
          <Legend 
            formatter={(value) => value === 'morning' ? '☀️ Morning' : '🌙 Evening'}
            wrapperStyle={{ fontSize: '12px' }}
          />
        )}
        {hasMorning && (
          <Line
            type="monotone"
            dataKey="morning"
            name="morning"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
            connectNulls
          />
        )}
        {hasEvening && (
          <Line
            type="monotone"
            dataKey="evening"
            name="evening"
            stroke="hsl(var(--secondary-foreground))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--secondary-foreground))', strokeWidth: 0, r: 4 }}
            activeDot={{ r: 6, fill: 'hsl(var(--secondary-foreground))' }}
            connectNulls
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
