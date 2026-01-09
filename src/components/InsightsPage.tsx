import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart } from 'lucide-react';
import { zh } from '@/lib/i18n';

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
  // 周期长度趋势数据
  const cycleLengthData = useMemo(() => {
    return cycles
      .filter((c) => c.cycleLength)
      .slice(-6)
      .map((c, i) => ({
        cycle: `第${i + 1}周期`,
        length: c.cycleLength,
      }));
  }, [cycles]);

  // 症状频率数据
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

  // 心情分布
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

  // 计算规律性评分
  const regularityScore = useMemo(() => {
    if (cycles.length < 3) return null;
    
    const lengths = cycles.filter((c) => c.cycleLength).map((c) => c.cycleLength!);
    if (lengths.length < 3) return null;
    
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    
    // 评分从0-100，标准差越低评分越高
    const score = Math.max(0, Math.min(100, 100 - stdDev * 10));
    return Math.round(score);
  }, [cycles]);

  // 获取心情表情
  const getMoodEmoji = (moodLabel: string): string => {
    const mood = zh.moods.find(m => m.label === moodLabel);
    return mood?.emoji || '😐';
  };

  const hasData = cycles.length > 0 || dailyLogs.length > 0;

  if (!hasData) {
    return (
      <div className="min-h-screen pb-24 px-4 pt-6 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <TrendingUp className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">{zh.insights.noData}</h2>
        <p className="text-muted-foreground text-center max-w-xs">
          {zh.insights.noDataDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">{zh.insights.title}</h1>

      {/* 统计网格 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{zh.insights.avgCycleLength}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averageCycleLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">{zh.insights.days}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-phase-menstrual" />
              <span className="text-xs text-muted-foreground">{zh.insights.avgPeriodLength}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averagePeriodLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">{zh.insights.days}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-phase-ovulation" />
              <span className="text-xs text-muted-foreground">{zh.insights.totalCycles}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.totalCyclesTracked}
              <span className="text-sm font-normal text-muted-foreground ml-1">{zh.insights.cycles}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-phase-follicular" />
              <span className="text-xs text-muted-foreground">规律性</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {regularityScore !== null ? (
                <>
                  {regularityScore}
                  <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">需要3+周期</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 周期长度趋势 */}
      {cycleLengthData.length > 1 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">{zh.insights.cycleLengthTrend}</h3>
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

      {/* 常见症状 */}
      {symptomData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">{zh.insights.symptomFrequency}</h3>
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

      {/* 心情分布 */}
      {moodData.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">{zh.insights.moodPatterns}</h3>
            <div className="space-y-3">
              {moodData.map((item) => (
                <div key={item.mood} className="flex items-center gap-3">
                  <span className="text-2xl">{getMoodEmoji(item.mood)}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-foreground">{item.mood}</span>
                      <span className="text-muted-foreground">{item.count} 天</span>
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
