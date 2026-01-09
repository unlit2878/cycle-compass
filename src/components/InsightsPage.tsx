import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  XAxis, YAxis, ResponsiveContainer, BarChart, Bar, Cell, 
  Tooltip, PieChart, Pie, Legend
} from 'recharts';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { TrendingUp, Calendar, Activity, Heart, Droplets, Target, Zap, Moon, ChevronDown, Info } from 'lucide-react';
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
import { predictNextCycle, evaluatePredictionAccuracy, getMethodName } from '@/lib/prediction-utils';

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
            <div className="relative pl-0 pr-12">
              {/* 平均周期虚线 */}
              {(() => {
                // 计算每个周期的实际周期长度（从当前经期开始到下次经期开始）
                const sortedCycles = [...filteredCycles].sort((a, b) => 
                  parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
                );
                const cycleLengths = sortedCycles.map((cycle, idx) => {
                  const nextCycle = sortedCycles[idx + 1];
                  if (nextCycle) {
                    return differenceInDays(parseISO(nextCycle.startDate), parseISO(cycle.startDate));
                  }
                  return null;
                }).filter(Boolean) as number[];
                
                const maxCycleLength = Math.max(
                  ...cycleLengths,
                  statistics.averageCycleLength,
                  45 // 最小显示宽度
                );
                const avgPosition = (statistics.averageCycleLength / maxCycleLength) * 100;
                return (
                  <div 
                    className="absolute top-0 bottom-0 border-l border-dashed border-phase-ovulation/70 z-10"
                    style={{ left: `${avgPosition}%` }}
                  >
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-phase-ovulation whitespace-nowrap">
                      平均 {statistics.averageCycleLength}天
                    </span>
                  </div>
                );
              })()}
              
              {/* 周期列表 - 最新的在上面 */}
              <div className="space-y-3 pt-4">
                {(() => {
                  // 排序：时间早的在后面，时间近的在前面
                  const sortedCycles = [...filteredCycles].sort((a, b) => 
                    parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()
                  );
                  
                  // 按时间正序排列用于计算周期长度
                  const chronologicalCycles = [...filteredCycles].sort((a, b) => 
                    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
                  );
                  
                  // 计算每个周期的实际周期长度
                  const cycleLengthMap = new Map<string, number>();
                  chronologicalCycles.forEach((cycle, idx) => {
                    const nextCycle = chronologicalCycles[idx + 1];
                    if (nextCycle) {
                      const length = differenceInDays(parseISO(nextCycle.startDate), parseISO(cycle.startDate));
                      cycleLengthMap.set(String(cycle.id || cycle.startDate), length);
                    }
                  });
                  
                  const allCycleLengths = Array.from(cycleLengthMap.values());
                  const maxCycleLength = Math.max(
                    ...allCycleLengths,
                    statistics.averageCycleLength,
                    45
                  );
                  
                  const today = new Date();
                  
                  return sortedCycles.map((cycle, index) => {
                    const startDate = parseISO(cycle.startDate);
                    const endDate = cycle.endDate ? parseISO(cycle.endDate) : null;
                    const periodDays = endDate 
                      ? differenceInDays(endDate, startDate) + 1 
                      : 0;
                    
                    // 获取当前周期的实际周期长度
                    const cycleKey = String(cycle.id || cycle.startDate);
                    const actualCycleLength = cycleLengthMap.get(cycleKey);
                    
                    // 找下一个周期的开始日期
                    const chronoIndex = chronologicalCycles.findIndex(c => String(c.id || c.startDate) === cycleKey);
                    const nextCycle = chronologicalCycles[chronoIndex + 1];
                    const cycleEndDate = nextCycle ? parseISO(nextCycle.startDate) : null;
                    
                    // 判断是否是当前周期（包含今天的周期）
                    const isCurrentCycle = !nextCycle && startDate <= today;
                    
                    const periodPercent = actualCycleLength 
                      ? (periodDays / maxCycleLength) * 100 
                      : (periodDays / maxCycleLength) * 100;
                    const cyclePercent = actualCycleLength 
                      ? (actualCycleLength / maxCycleLength) * 100 
                      : 0;
                    
                    return (
                      <div key={cycle.id || index} className="space-y-0.5">
                        {/* 日期范围 */}
                        <div className="flex items-center gap-2">
                          {isCurrentCycle && (
                            <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                              当前周期
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground/70">
                            {format(startDate, 'yyyy年M月d日', { locale: zhCN })}
                            {cycleEndDate 
                              ? ` - ${format(cycleEndDate, 'yyyy年M月d日', { locale: zhCN })}` 
                              : ' - 进行中'}
                          </span>
                        </div>
                        
                        {/* 进度条 - 更细更简洁 */}
                        <div className="relative h-3 flex items-center">
                          {/* 背景轨道 */}
                          <div 
                            className="absolute left-0 h-1.5 bg-muted/30 rounded-full"
                            style={{ width: actualCycleLength ? `${cyclePercent}%` : `${periodPercent}%` }}
                          />
                          {/* 经期部分（填充） */}
                          <div 
                            className="absolute left-0 h-1.5 bg-phase-menstrual rounded-full transition-all duration-300"
                            style={{ width: `${periodPercent}%` }}
                          />
                          
                          {/* 数据标注 - 在右侧 */}
                          <div 
                            className="absolute flex items-center gap-1.5 text-[10px]"
                            style={{ left: `${Math.max(cyclePercent, periodPercent) + 1}%` }}
                          >
                            <span className="text-phase-menstrual font-medium">{periodDays}天</span>
                            {actualCycleLength && (
                              <>
                                <span className="text-muted-foreground/50">/</span>
                                <span className="text-muted-foreground">{actualCycleLength}天</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            
            {/* 图例 */}
            <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2 h-1.5 rounded-full bg-phase-menstrual" />
                <span>经期天数</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-1.5 rounded-full bg-muted/30" />
                <span>周期长度</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-0 border-t border-dashed border-phase-ovulation/70" />
                <span>平均周期</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 预测准确性分析 - 使用统计学方法 */}
      {(() => {
        // 使用新的统计预测方法
        const prediction = predictNextCycle(cycles);
        const accuracy = evaluatePredictionAccuracy(cycles);
        
        if (accuracy.predictions.length === 0) return null;
        
        // 只显示最近的预测记录
        const recentPredictions = accuracy.predictions.slice(-6).reverse();
        
        return (
          <Card className="border-0 shadow-lg mb-6 card-hover">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Target className="w-4 h-4 text-phase-ovulation" />
                预测准确性分析
              </h3>
              
              {/* 预测方法说明 */}
              <div className="bg-muted/30 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-[11px] text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">
                      当前使用: {getMethodName(prediction.method)}
                    </p>
                    <p>
                      预测周期: {prediction.predictedCycleLength} 天
                      (置信区间: {prediction.lowerBound}-{prediction.upperBound} 天)
                    </p>
                    <p className="mt-1 opacity-80">
                      {prediction.method === 'sma' && '周期非常规律，使用简单移动平均'}
                      {prediction.method === 'weighted' && '周期较规律，使用加权移动平均给近期更高权重'}
                      {prediction.method === 'ewma' && '周期波动较大，使用指数加权平均更重视近期数据'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* 准确性统计 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">准确率</p>
                  <p className="text-lg font-bold text-foreground">
                    {accuracy.accuracyRate}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">±2天内</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">平均误差</p>
                  <p className="text-lg font-bold text-foreground">
                    {accuracy.avgError.toFixed(1)}
                    <span className="text-xs font-normal ml-0.5">天</span>
                  </p>
                  <p className="text-[9px] text-muted-foreground">绝对值</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">置信度</p>
                  <p className="text-lg font-bold text-foreground">
                    {Math.round(prediction.confidence * 100)}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">统计估算</p>
                </div>
              </div>
              
              {/* 预测记录 */}
              <p className="text-xs text-muted-foreground mb-2">最近预测记录（使用统计方法回测）</p>
              <div className="space-y-2">
                {recentPredictions.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1.5 border-b border-muted/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {format(parseISO(p.cycleDate), 'yyyy年M月d日', { locale: zhCN })}
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">
                        ({p.method === 'sma' ? 'SMA' : p.method === 'ewma' ? 'EWMA' : 'WMA'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/70 text-[10px]">
                        预测{p.predicted}天 / 实际{p.actual}天
                      </span>
                      <span className={`font-medium min-w-[50px] text-right ${
                        Math.abs(p.error) <= 2 
                          ? 'text-green-500' 
                          : Math.abs(p.error) <= 4 
                            ? 'text-yellow-500' 
                            : 'text-phase-menstrual'
                      }`}>
                        {p.error === 0 ? '准确' : p.error > 0 ? `+${p.error}天` : `${p.error}天`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
