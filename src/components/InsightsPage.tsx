import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, 
  AreaChart, Area, Tooltip, PieChart, Pie 
} from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart, Droplets, ListChecks } from 'lucide-react';
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
        cycle: `周期${i + 1}`,
        length: c.cycleLength,
      }));
  }, [cycles]);

  // 经期长度趋势数据
  const periodLengthData = useMemo(() => {
    return cycles
      .filter((c) => c.startDate && c.endDate)
      .slice(-6)
      .map((c, i) => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate!);
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return {
          cycle: `周期${i + 1}`,
          days,
        };
      });
  }, [cycles]);

  // 历史周期记录
  const cycleHistory = useMemo(() => {
    return [...cycles]
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
      .slice(0, 12)
      .map((c) => {
        const startDate = new Date(c.startDate);
        const endDate = c.endDate ? new Date(c.endDate) : null;
        const periodDays = endDate 
          ? Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
          : null;
        
        return {
          id: c.id,
          startDate: c.startDate,
          endDate: c.endDate,
          cycleLength: c.cycleLength,
          periodDays,
          startFormatted: `${startDate.getMonth() + 1}月${startDate.getDate()}日`,
          endFormatted: endDate ? `${endDate.getMonth() + 1}月${endDate.getDate()}日` : '未记录',
        };
      });
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

  // 心情分布（饼图数据）
  const moodData = useMemo(() => {
    const moodCount: Record<string, number> = {};
    dailyLogs.forEach((log) => {
      if (log.mood) {
        moodCount[log.mood] = (moodCount[log.mood] || 0) + 1;
      }
    });

    const colors = ['hsl(var(--phase-menstrual))', 'hsl(var(--phase-follicular))', 'hsl(var(--phase-ovulation))', 'hsl(var(--phase-luteal))', 'hsl(var(--primary))'];
    
    return Object.entries(moodCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mood, count], index) => ({ mood, count, fill: colors[index] }));
  }, [dailyLogs]);

  // 经量分布
  const flowData = useMemo(() => {
    const flowCount: Record<string, number> = { light: 0, medium: 0, heavy: 0 };
    dailyLogs.forEach((log) => {
      if (log.isPeriod && log.flowIntensity) {
        flowCount[log.flowIntensity]++;
      }
    });

    return [
      { name: '少量', value: flowCount.light, fill: 'hsl(var(--phase-follicular))' },
      { name: '适中', value: flowCount.medium, fill: 'hsl(var(--phase-ovulation))' },
      { name: '大量', value: flowCount.heavy, fill: 'hsl(var(--phase-menstrual))' },
    ].filter(d => d.value > 0);
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
                <AreaChart data={cycleLengthData}>
                  <defs>
                    <linearGradient id="cycleLengthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                  <Tooltip 
                    formatter={(value) => [`${value}天`, '周期长度']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="length"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#cycleLengthGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 经期长度趋势 */}
      {periodLengthData.length > 1 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">经期天数趋势</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodLengthData}>
                  <XAxis
                    dataKey="cycle"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={25}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value}天`, '经期天数']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="days" radius={[4, 4, 0, 0]} fill="hsl(var(--phase-menstrual))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 经量分布 */}
      {flowData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">
              <Droplets className="w-4 h-4 inline mr-2 text-phase-menstrual" />
              经量分布
            </h3>
            <div className="flex items-center">
              <div className="h-32 w-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={flowData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      paddingAngle={2}
                    >
                      {flowData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 ml-4 space-y-2">
                {flowData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.value}天</span>
                  </div>
                ))}
              </div>
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
                    width={70}
                  />
                  <Tooltip 
                    formatter={(value) => [`${value}次`, '出现次数']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
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
        <Card className="border-0 shadow-lg mb-6">
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
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(item.count / moodData[0].count) * 100}%`,
                          backgroundColor: item.fill,
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

      {/* 历史周期记录 */}
      {cycleHistory.length > 0 && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              历史周期记录
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {cycleHistory.map((cycle, index) => (
                <div 
                  key={cycle.id || index} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-phase-menstrual" />
                      <span className="font-medium text-foreground text-sm">
                        {cycle.startFormatted} - {cycle.endFormatted}
                      </span>
                    </div>
                    {cycle.periodDays && (
                      <span className="text-xs text-muted-foreground ml-4">
                        经期 {cycle.periodDays} 天
                      </span>
                    )}
                  </div>
                  {cycle.cycleLength && (
                    <div className="text-right">
                      <span className="text-sm font-medium text-foreground">{cycle.cycleLength}</span>
                      <span className="text-xs text-muted-foreground ml-1">天周期</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}