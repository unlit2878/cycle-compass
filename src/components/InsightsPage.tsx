import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart } from 'lucide-react';

interface InsightsPageProps {
  settings: Settings | null;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
  statistics: {
    averageCycleLength: number;
    averagePeriodLength: number;
    totalCyclesTracked: number;
    totalDaysLogged: number;
  };
}

export function InsightsPage({ settings, cycles, dailyLogs, statistics }: InsightsPageProps) {
  // Cycle length trend data
  const cycleLengthData = useMemo(() => {
    return cycles
      .filter((c) => c.cycleLength)
      .slice(-6)
      .map((c, i) => ({
        cycle: `Cycle ${i + 1}`,
        length: c.cycleLength,
      }));
  }, [cycles]);

  // Symptom frequency data
  const symptomData = useMemo(() => {
    const symptomCount: Record<string, number> = {};
    dailyLogs.forEach((log) => {
      log.symptoms.forEach((symptom) => {
        symptomCount[symptom] = (symptomCount[symptom] || 0) + 1;
      });
    });

    return Object.entries(symptomCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symptom, count]) => ({ symptom, count }));
  }, [dailyLogs]);

  // Mood distribution
  const moodData = useMemo(() => {
    const moodCount: Record<string, number> = {};
    dailyLogs.forEach((log) => {
      if (log.mood) {
        moodCount[log.mood] = (moodCount[log.mood] || 0) + 1;
      }
    });

    return Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mood, count]) => ({ mood, count }));
  }, [dailyLogs]);

  // Calculate regularity score
  const regularityScore = useMemo(() => {
    if (cycles.length < 3) return null;
    
    const lengths = cycles.filter((c) => c.cycleLength).map((c) => c.cycleLength!);
    if (lengths.length < 3) return null;
    
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // Score from 0-100, lower standard deviation = higher score
    const score = Math.max(0, Math.min(100, 100 - stdDev * 10));
    return Math.round(score);
  }, [cycles]);

  const hasData = cycles.length > 0 || dailyLogs.length > 0;

  if (!hasData) {
    return (
      <div className="min-h-screen pb-24 px-4 pt-6 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <TrendingUp className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">No Data Yet</h2>
        <p className="text-muted-foreground text-center max-w-xs">
          Start logging your cycle to see insights and statistics here.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Insights</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Cycle</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averageCycleLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-phase-menstrual" />
              <span className="text-xs text-muted-foreground">Avg Period</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averagePeriodLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-phase-ovulation" />
              <span className="text-xs text-muted-foreground">Cycles Tracked</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statistics.totalCyclesTracked}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-phase-follicular" />
              <span className="text-xs text-muted-foreground">Regularity</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {regularityScore !== null ? (
                <>
                  {regularityScore}
                  <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">Need 3+ cycles</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cycle Length Trend */}
      {cycleLengthData.length > 1 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Cycle Length Trend</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cycleLengthData}>
                  <XAxis
                    dataKey="cycle"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Line
                    type="monotone"
                    dataKey="length"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Symptoms */}
      {symptomData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Most Common Symptoms</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symptomData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="symptom"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={90}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {symptomData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`hsl(var(--phase-${['menstrual', 'follicular', 'ovulation', 'luteal', 'menstrual'][index]}))`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mood Patterns */}
      {moodData.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">Mood Patterns</h3>
            <div className="space-y-3">
              {moodData.map((item, i) => (
                <div key={item.mood} className="flex items-center gap-3">
                  <span className="text-2xl">
                    {item.mood === 'Happy' && '😊'}
                    {item.mood === 'Calm' && '😌'}
                    {item.mood === 'Anxious' && '😰'}
                    {item.mood === 'Sad' && '😢'}
                    {item.mood === 'Irritable' && '😤'}
                    {item.mood === 'Energetic' && '⚡'}
                    {item.mood === 'Tired' && '😴'}
                    {item.mood === 'Loving' && '🥰'}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground">{item.mood}</span>
                      <span className="text-muted-foreground">{item.count} days</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${(item.count / moodData[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
