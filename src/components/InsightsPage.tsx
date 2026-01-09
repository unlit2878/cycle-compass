import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, 
  Tooltip, PieChart, Pie, ComposedChart, ReferenceLine, Legend
} from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart, Droplets, Target, Zap, Moon, Clock, ChevronDown } from 'lucide-react';
import { zh } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, differenceInDays, getMonth, getYear, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { zhCN } from 'date-fns/locale';

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

type TimeRange = 'recent6' | 'recent12' | 'all' | 'year';

export function InsightsPage({ settings, cycles, dailyLogs, statistics }: InsightsPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('recent6');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // 获取可用的年份
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    cycles.forEach(c => years.add(getYear(parseISO(c.startDate))));
    return Array.from(years).sort((a, b) => b - a);
  }, [cycles]);

  // 根据时间范围过滤周期
  const filteredCycles = useMemo(() => {
    let filtered = [...cycles].sort((a, b) => 
      parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
    );
    
    switch (timeRange) {
      case 'recent6':
        return filtered.slice(-6);
      case 'recent12':
        return filtered.slice(-12);
      case 'year':
        return filtered.filter(c => getYear(parseISO(c.startDate)) === selectedYear);
      case 'all':
      default:
        return filtered;
    }
  }, [cycles, timeRange, selectedYear]);

  // 综合周期图表数据（堆叠柱状图）
  const combinedCycleData = useMemo(() => {
    return filteredCycles.map((c) => {
      const startDate = parseISO(c.startDate);
      const endDate = c.endDate ? parseISO(c.endDate) : null;
      const periodDays = endDate 
        ? differenceInDays(endDate, startDate) + 1
        : null;
      const nonPeriodDays = c.cycleLength && periodDays 
        ? c.cycleLength - periodDays 
        : null;

      return {
        label: format(startDate, 'yyyy年M月', { locale: zhCN }),
        shortLabel: format(startDate, 'M月', { locale: zhCN }),
        startDate: c.startDate,
        periodDays: periodDays || 0,
        nonPeriodDays: nonPeriodDays || 0,
        cycleLength: c.cycleLength || 0,
        periodEndDate: c.endDate ? format(parseISO(c.endDate), 'M/d') : '-',
      };
    });
  }, [filteredCycles]);

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
      .slice(0, 6)
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
      .map(([mood, count], index) => ({ mood, count, fill: colors[index % colors.length] }));
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
    
    const score = Math.max(0, Math.min(100, 100 - stdDev * 10));
    return Math.round(score);
  }, [cycles]);

  // 周期长度范围
  const cycleLengthRange = useMemo(() => {
    const lengths = cycles.filter((c) => c.cycleLength).map((c) => c.cycleLength!);
    if (lengths.length === 0) return null;
    return {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
    };
  }, [cycles]);

  // 经期天数范围
  const periodLengthRange = useMemo(() => {
    const lengths = filteredCycles.map(c => {
      if (!c.endDate) return null;
      return differenceInDays(parseISO(c.endDate), parseISO(c.startDate)) + 1;
    }).filter(Boolean) as number[];
    
    if (lengths.length === 0) return null;
    return {
      min: Math.min(...lengths),
      max: Math.max(...lengths),
      avg: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
    };
  }, [filteredCycles]);

  // 记录天数分布（按月统计）
  const monthlyLogData = useMemo(() => {
    const monthCount: Record<string, number> = {};
    dailyLogs.forEach((log) => {
      const monthKey = format(parseISO(log.date), 'yyyy-MM');
      monthCount[monthKey] = (monthCount[monthKey] || 0) + 1;
    });

    return Object.entries(monthCount)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({
        month: format(parseISO(month + '-01'), 'M月', { locale: zhCN }),
        count,
      }));
  }, [dailyLogs]);

  // 症状与经期关联分析
  const symptomPhaseData = useMemo(() => {
    const periodSymptoms: Record<string, number> = {};
    const nonPeriodSymptoms: Record<string, number> = {};

    dailyLogs.forEach((log) => {
      log.symptoms.forEach((symptom) => {
        if (log.isPeriod) {
          periodSymptoms[symptom] = (periodSymptoms[symptom] || 0) + 1;
        } else {
          nonPeriodSymptoms[symptom] = (nonPeriodSymptoms[symptom] || 0) + 1;
        }
      });
    });

    const allSymptoms = new Set([...Object.keys(periodSymptoms), ...Object.keys(nonPeriodSymptoms)]);
    
    return Array.from(allSymptoms)
      .map(symptom => ({
        symptom,
        period: periodSymptoms[symptom] || 0,
        nonPeriod: nonPeriodSymptoms[symptom] || 0,
        total: (periodSymptoms[symptom] || 0) + (nonPeriodSymptoms[symptom] || 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [dailyLogs]);

  // 获取心情表情
  const getMoodEmoji = (moodLabel: string): string => {
    const mood = zh.moods.find(m => m.label === moodLabel);
    return mood?.emoji || '😐';
  };

  const hasData = cycles.length > 0 || dailyLogs.length > 0;

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'recent6': return '最近6个周期';
      case 'recent12': return '最近12个周期';
      case 'year': return `${selectedYear}年`;
      case 'all': return '全部记录';
    }
  };

  if (!hasData) {
    return (
      <div className="min-h-screen pb-24 px-4 pt-6 flex flex-col items-center justify-center page-enter">
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
    <div className="min-h-screen pb-24 px-4 pt-6 page-enter">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">{zh.insights.title}</h1>
        
        {/* 时间范围选择器 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 btn-press">
              {getTimeRangeLabel()}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="animate-scale-in">
            <DropdownMenuItem onClick={() => setTimeRange('recent6')}>
              最近6个周期
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTimeRange('recent12')}>
              最近12个周期
            </DropdownMenuItem>
            {availableYears.map(year => (
              <DropdownMenuItem 
                key={year} 
                onClick={() => {
                  setTimeRange('year');
                  setSelectedYear(year);
                }}
              >
                {year}年
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setTimeRange('all')}>
              全部记录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 统计网格 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">{zh.insights.avgCycleLength}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averageCycleLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">{zh.insights.days}</span>
            </p>
            {cycleLengthRange && cycleLengthRange.min !== cycleLengthRange.max && (
              <p className="text-xs text-muted-foreground mt-1">
                范围 {cycleLengthRange.min}-{cycleLengthRange.max} 天
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-phase-menstrual" />
              <span className="text-xs text-muted-foreground">{zh.insights.avgPeriodLength}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {statistics.averagePeriodLength}
              <span className="text-sm font-normal text-muted-foreground ml-1">{zh.insights.days}</span>
            </p>
            {periodLengthRange && periodLengthRange.min !== periodLengthRange.max && (
              <p className="text-xs text-muted-foreground mt-1">
                范围 {periodLengthRange.min}-{periodLengthRange.max} 天
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg card-hover">
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

        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-phase-follicular" />
              <span className="text-xs text-muted-foreground">规律性评分</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {regularityScore !== null ? (
                <>
                  {regularityScore}
                  <span className="text-sm font-normal text-muted-foreground ml-1">分</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">需3+周期</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 综合周期图表 - 堆叠柱状图 */}
      {combinedCycleData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6 card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              周期与经期时长分析
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              红色=经期天数，蓝色=非经期天数，虚线=平均周期长度
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={combinedCycleData} 
                  layout="vertical"
                  margin={{ top: 10, right: 10, bottom: 10, left: 50 }}
                >
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 'dataMax + 5']}
                  />
                  <YAxis 
                    type="category" 
                    dataKey={combinedCycleData.length > 6 ? "shortLabel" : "label"}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                            <p className="font-medium mb-1">{data.label}</p>
                            <p className="text-phase-menstrual">经期: {data.periodDays} 天</p>
                            <p className="text-primary">非经期: {data.nonPeriodDays} 天</p>
                            <p className="text-muted-foreground">总周期: {data.cycleLength} 天</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px' }}
                    payload={[
                      { value: '经期天数', type: 'square', color: 'hsl(var(--phase-menstrual))' },
                      { value: '非经期天数', type: 'square', color: 'hsl(var(--primary))' },
                    ]}
                  />
                  <Bar 
                    dataKey="periodDays" 
                    stackId="a" 
                    fill="hsl(var(--phase-menstrual))" 
                    radius={[0, 0, 0, 0]}
                    name="经期天数"
                  />
                  <Bar 
                    dataKey="nonPeriodDays" 
                    stackId="a" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                    name="非经期天数"
                  />
                  <ReferenceLine 
                    x={statistics.averageCycleLength} 
                    stroke="hsl(var(--phase-ovulation))" 
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    label={{ 
                      value: `平均${statistics.averageCycleLength}天`, 
                      position: 'top',
                      fontSize: 10,
                      fill: 'hsl(var(--phase-ovulation))'
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 经量分布 + 心情分布 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {/* 经量分布 */}
        {flowData.length > 0 && (
          <Card className="border-0 shadow-lg card-hover">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
                <Droplets className="w-4 h-4 text-phase-menstrual" />
                经量分布
              </h3>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={flowData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={20}
                      outerRadius={40}
                      paddingAngle={2}
                    >
                      {flowData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}天`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 mt-2">
                {flowData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-foreground">{item.name}</span>
                    </div>
                    <span className="text-muted-foreground">{item.value}天</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 心情分布 */}
        {moodData.length > 0 && (
          <Card className="border-0 shadow-lg card-hover">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
                <Moon className="w-4 h-4 text-phase-luteal" />
                心情分布
              </h3>
              <div className="space-y-2">
                {moodData.slice(0, 4).map((item) => (
                  <div key={item.mood} className="flex items-center gap-2">
                    <span className="text-lg">{getMoodEmoji(item.mood)}</span>
                    <div className="flex-1">
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
                    <span className="text-xs text-muted-foreground w-6 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 症状与经期关联分析 */}
      {symptomPhaseData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6 card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-phase-ovulation" />
              症状与经期关联
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              对比症状在经期与非经期的出现频率
            </p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={symptomPhaseData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="symptom"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                            <p className="font-medium">{data.symptom}</p>
                            <p className="text-phase-menstrual">经期: {data.period}次</p>
                            <p className="text-primary">非经期: {data.nonPeriod}次</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px' }}
                    payload={[
                      { value: '经期', type: 'square', color: 'hsl(var(--phase-menstrual))' },
                      { value: '非经期', type: 'square', color: 'hsl(var(--primary))' },
                    ]}
                  />
                  <Bar dataKey="period" stackId="a" fill="hsl(var(--phase-menstrual))" />
                  <Bar dataKey="nonPeriod" stackId="a" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 常见症状 */}
      {symptomData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6 card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4">{zh.insights.symptomFrequency}</h3>
            <div className="h-36">
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
                        fill={`hsl(var(--phase-${['menstrual', 'follicular', 'ovulation', 'luteal', 'menstrual', 'follicular'][index]}))`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 记录活跃度 */}
      {monthlyLogData.length > 0 && (
        <Card className="border-0 shadow-lg mb-6 card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              月度记录活跃度
            </h3>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyLogData}>
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(value) => [`${value}天`, '记录天数']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--phase-follicular))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 历史周期列表 */}
      {filteredCycles.length > 0 && (
        <Card className="border-0 shadow-lg card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              历史周期记录
              <span className="text-xs text-muted-foreground font-normal">
                ({filteredCycles.length}个)
              </span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {[...filteredCycles].reverse().map((cycle, index) => {
                const startDate = parseISO(cycle.startDate);
                const endDate = cycle.endDate ? parseISO(cycle.endDate) : null;
                const periodDays = endDate 
                  ? differenceInDays(endDate, startDate) + 1 
                  : null;

                return (
                  <div 
                    key={cycle.id || index} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-phase-menstrual/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-phase-menstrual">
                          {format(startDate, 'M月')}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">
                          {format(startDate, 'M月d日')} - {endDate ? format(endDate, 'M月d日') : '进行中'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {periodDays ? `经期 ${periodDays} 天` : '未记录结束'}
                          {cycle.cycleLength && ` · 周期 ${cycle.cycleLength} 天`}
                        </p>
                      </div>
                    </div>
                    {cycle.cycleLength && (
                      <div className="text-right">
                        <span className="text-lg font-bold text-foreground">{cycle.cycleLength}</span>
                        <span className="text-xs text-muted-foreground ml-0.5">天</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
