import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ExerciseRecord {
  date: string;
  maxWeight: number;
  maxReps: number;
  totalVolume: number;
}

interface ExerciseProgressChartProps {
  records: ExerciseRecord[];
  weightUnit: 'lb' | 'kg';
}

export function ExerciseProgressChart({ records, weightUnit }: ExerciseProgressChartProps) {
  const chartData = useMemo(() => {
    // Sort by date ascending for chart
    return [...records]
      .sort((a, b) => new Date(`${a.date}T00:00:00`).getTime() - new Date(`${b.date}T00:00:00`).getTime())
      .map(record => ({
        date: new Date(`${record.date}T00:00:00`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        fullDate: record.date,
        maxWeight: record.maxWeight,
        volume: Math.round(record.totalVolume),
      }));
  }, [records]);

  if (chartData.length < 2) {
    return (
      <div className="text-center text-muted-foreground py-8 text-sm">
        Need at least 2 workout sessions to show progress
      </div>
    );
  }

  const minWeight = Math.min(...chartData.map(d => d.maxWeight));
  const maxWeight = Math.max(...chartData.map(d => d.maxWeight));
  const weightPadding = Math.max((maxWeight - minWeight) * 0.1, 5);

  return (
    <div className="space-y-6">
      {/* Weight Progress Chart */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Weight Progress</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[
                  Math.floor(minWeight - weightPadding),
                  Math.ceil(maxWeight + weightPadding),
                ]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value} ${weightUnit}`, 'Max Weight']}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="maxWeight"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Volume Progress Chart */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Volume Progress</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value.toLocaleString()} ${weightUnit}`, 'Total Volume']}
                labelFormatter={(label) => label}
              />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="hsl(var(--accent))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--accent))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
