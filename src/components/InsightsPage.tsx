import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, 
  Tooltip, PieChart, Pie, Legend
} from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart, Droplets, Target, Zap, Moon, ChevronDown } from 'lucide-react';
import { zh } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, differenceInDays, getYear } from 'date-fns';
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

      {/* 周期与经期时长分析 - 自定义进度条样式 */}
      {filteredCycles.length > 0 && (
        <Card className="border-0 shadow-lg mb-6 card-hover">
          <CardContent className="p-4">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              周期与经期时长分析
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              红色=经期天数，虚线=平均周期长度 ({statistics.averageCycleLength}天)
            </p>
            
            {/* 进度条图表容器 */}
            <div className="relative">
              {/* 平均周期虚线 */}
              {(() => {
                const maxCycleLength = Math.max(
                  ...filteredCycles.map(c => c.cycleLength || 0),
                  statistics.averageCycleLength
                );
                const avgPosition = (statistics.averageCycleLength / maxCycleLength) * 100;
                return (
                  <div 
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-phase-ovulation z-10"
                    style={{ left: `${avgPosition}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-phase-ovulation whitespace-nowrap">
                      平均 {statistics.averageCycleLength}天
                    </span>
                  </div>
                );
              })()}
              
              {/* 周期列表 */}
              <div className="space-y-4 pt-4">
                {[...filteredCycles].reverse().map((cycle, index) => {
                  const startDate = parseISO(cycle.startDate);
                  const endDate = cycle.endDate ? parseISO(cycle.endDate) : null;
                  const periodDays = endDate 
                    ? differenceInDays(endDate, startDate) + 1 
                    : 0;
                  const cycleLength = cycle.cycleLength || periodDays;
                  
                  // 找下一个周期的开始日期来计算完整周期范围
                  const sortedCycles = [...filteredCycles].sort((a, b) => 
                    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
                  );
                  const currentIndex = sortedCycles.findIndex(c => c.id === cycle.id);
                  const nextCycle = sortedCycles[currentIndex + 1];
                  const cycleEndDate = nextCycle 
                    ? parseISO(nextCycle.startDate)
                    : null;
                  
                  const maxCycleLength = Math.max(
                    ...filteredCycles.map(c => c.cycleLength || 0),
                    statistics.averageCycleLength
                  );
                  const periodPercent = (periodDays / maxCycleLength) * 100;
                  const cyclePercent = (cycleLength / maxCycleLength) * 100;
                  
                  const isLatest = index === 0;
                  
                  return (
                    <div key={cycle.id || index} className="space-y-1">
                      {/* 日期范围 */}
                      <div className="text-xs text-muted-foreground">
                        {isLatest && <span className="text-primary font-medium mr-2">当前周期</span>}
                        {format(startDate, 'yyyy年M月d日')}
                        {cycleEndDate ? ` - ${format(cycleEndDate, 'yyyy年M月d日')}` : ' - 进行中'}
                      </div>
                      
                      {/* 进度条 */}
                      <div className="relative h-6 bg-muted/50 rounded-full overflow-visible">
                        {/* 经期部分（填充） */}
                        <div 
                          className="absolute left-0 top-0 h-full bg-phase-menstrual rounded-l-full transition-all duration-300"
                          style={{ width: `${periodPercent}%` }}
                        />
                        {/* 周期边框（空心） */}
                        <div 
                          className="absolute left-0 top-0 h-full border-2 border-muted-foreground/30 rounded-full transition-all duration-300"
                          style={{ width: `${cyclePercent}%` }}
                        />
                        
                        {/* 标注信息 */}
                        <div className="absolute inset-0 flex items-center px-3">
                          <span className="text-xs font-medium text-white drop-shadow-sm">
                            {periodDays > 0 ? `${periodDays}天` : ''}
                          </span>
                        </div>
                        
                        {/* 周期长度标注 */}
                        {cycleLength > 0 && (
                          <span 
                            className="absolute top-1/2 -translate-y-1/2 text-xs text-muted-foreground ml-2"
                            style={{ left: `${cyclePercent}%` }}
                          >
                            周期 {cycleLength}天
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* 图例 */}
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-phase-menstrual" />
                <span>经期天数</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm border-2 border-muted-foreground/30" />
                <span>周期长度</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-0 border-t-2 border-dashed border-phase-ovulation" style={{ width: '12px' }} />
                <span>平均周期</span>
              </div>
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

    </div>
  );
}
