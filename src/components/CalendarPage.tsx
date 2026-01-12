import { useMemo, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, HelpCircle, CalendarDays } from 'lucide-react';
import { getDaysInMonth, formatDate, CyclePhase, getCyclePhase } from '@/lib/cycle-utils';
import { DailyLog, Settings, CycleData } from '@/lib/db';
import { zh, formatMonthYear } from '@/lib/i18n';
import { predictNextCycle } from '@/lib/prediction-utils';

interface CalendarPageProps {
  settings: Settings | null;
  dailyLogs: DailyLog[];
  cycles: CycleData[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDaySelect: (date: string) => void;
}

export function CalendarPage({ settings, dailyLogs, cycles, currentMonth, onMonthChange, onDaySelect }: CalendarPageProps) {
  // 滑动手势状态
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  // 动画状态
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'scale' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // 处理触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    setIsSwiping(true);
    setSwipeOffset(0);
  };

  // 处理触摸移动 - 实时更新偏移量
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    
    const diffX = touchEndX.current - touchStartX.current;
    const diffY = Math.abs(touchEndY.current - touchStartY.current);
    
    // 只有水平滑动距离大于垂直滑动时才更新偏移
    if (Math.abs(diffX) > diffY) {
      // 限制最大偏移量，并添加阻尼效果
      const maxOffset = 120;
      const dampedOffset = Math.sign(diffX) * Math.min(Math.abs(diffX) * 0.5, maxOffset);
      setSwipeOffset(dampedOffset);
    }
  };

  // 处理触摸结束
  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);
    
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = Math.abs(touchStartY.current - touchEndY.current);
    const threshold = 80; // 提高最小滑动距离
    
    // 只有当水平滑动距离大于垂直滑动距离1.5倍，且超过阈值时才切换
    if (Math.abs(diffX) > threshold && Math.abs(diffX) > diffY * 1.5) {
      if (diffX > 0) {
        // 左滑 -> 下个月
        navigateMonth(1);
      } else {
        // 右滑 -> 上个月
        navigateMonth(-1);
      }
    }
    
    // 重置偏移量
    setSwipeOffset(0);
  };

  // 带动画的月份导航
  const navigateMonth = useCallback((delta: number) => {
    setSlideDirection(delta > 0 ? 'left' : 'right');
    setAnimationKey(prev => prev + 1);
    
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    onMonthChange(newDate);
  }, [currentMonth, onMonthChange]);

  // 带动画的回到今天
  const goToToday = useCallback(() => {
    const today = new Date();
    setSlideDirection('scale');
    setAnimationKey(prev => prev + 1);
    // 重置到今天所在的月份
    const newMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    onMonthChange(newMonth);
  }, [onMonthChange]);

  // 设置年份（带动画）
  const setYear = (year: string) => {
    const newYear = parseInt(year);
    setSlideDirection(newYear > currentMonth.getFullYear() ? 'left' : 'right');
    setAnimationKey(prev => prev + 1);
    
    const newDate = new Date(currentMonth);
    newDate.setFullYear(newYear);
    onMonthChange(newDate);
  };

  // 设置月份（带动画）
  const setMonth = (month: string) => {
    const newMonth = parseInt(month);
    setSlideDirection(newMonth > currentMonth.getMonth() ? 'left' : 'right');
    setAnimationKey(prev => prev + 1);
    
    const newDate = new Date(currentMonth);
    newDate.setMonth(newMonth);
    onMonthChange(newDate);
  };

  // 获取动画类名
  const getAnimationClass = () => {
    if (!slideDirection) return '';
    switch (slideDirection) {
      case 'left': return 'calendar-slide-left';
      case 'right': return 'calendar-slide-right';
      case 'scale': return 'calendar-slide-enter';
      default: return '';
    }
  };

  // 使用统计预测获取周期长度（与首页统一）
  const predictedCycleLength = useMemo(() => {
    if (cycles.length >= 2) {
      const prediction = predictNextCycle(cycles);
      return prediction.predictedCycleLength;
    }
    return settings?.averageCycleLength || 28;
  }, [cycles, settings]);


  const monthData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const days = getDaysInMonth(year, month);
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    
    // 创建已记录日期的映射
    const logMap = new Map<string, DailyLog>();
    dailyLogs.forEach(log => logMap.set(log.date, log));
    
    return { days, firstDayOfWeek, logMap };
  }, [currentMonth, dailyLogs]);

  // 获取所有经期记录的日期映射（只从 cycles 表获取）
  const periodDates = useMemo(() => {
    const dates = new Set<string>();
    // 只从 cycles 获取（包括 startDate 到 endDate 之间的所有日期）
    cycles.forEach(cycle => {
      const start = new Date(cycle.startDate);
      const end = cycle.endDate ? new Date(cycle.endDate) : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.add(formatDate(new Date(d)));
      }
    });
    return dates;
  }, [cycles]);

  const getPhaseForDate = (date: Date): CyclePhase | null => {
    if (!settings?.lastPeriodStart) return null;
    
    const dateStr = formatDate(date);
    
    // 如果这一天有经期记录，返回 menstrual
    if (periodDates.has(dateStr)) {
      return 'menstrual';
    }
    
    const lastStart = new Date(settings.lastPeriodStart);
    const diffDays = Math.floor((date.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // 使用统计预测的周期长度
    const cycleLength = predictedCycleLength;
    let dayInCycle: number;
    
    if (diffDays >= 0) {
      dayInCycle = (diffDays % cycleLength) + 1;
    } else {
      // 向前推算：计算在哪个历史周期的第几天
      const cyclesBefore = Math.ceil(Math.abs(diffDays) / cycleLength);
      const adjustedDiff = diffDays + cyclesBefore * cycleLength;
      dayInCycle = (adjustedDiff % cycleLength) + 1;
    }
    
    return getCyclePhase(dayInCycle, cycleLength);
  };

  const phaseColorClass: Record<CyclePhase, string> = {
    menstrual: 'bg-phase-menstrual/25 border-phase-menstrual/60',
    follicular: 'bg-phase-follicular/25 border-phase-follicular/60',
    ovulation: 'bg-phase-ovulation/25 border-phase-ovulation/60',
    luteal: 'bg-phase-luteal/25 border-phase-luteal/60',
  };

  const phaseSolidClass: Record<CyclePhase, string> = {
    menstrual: 'bg-phase-menstrual text-white shadow-sm',
    follicular: 'bg-phase-follicular text-white shadow-sm',
    ovulation: 'bg-phase-ovulation text-foreground shadow-sm',
    luteal: 'bg-phase-luteal text-white shadow-sm',
  };


  const today = formatDate(new Date());
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth();
  const todayDate = new Date();
  const isCurrentMonth = todayDate.getFullYear() === currentYear && todayDate.getMonth() === currentMonthNum;

  // 生成年份选项（前后5年）
  const yearOptions = Array.from({ length: 11 }, (_, i) => todayDate.getFullYear() - 5 + i);
  const monthOptions = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth(-1)}
          className="rounded-full transition-transform active:scale-90"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-0">
          <Select value={currentYear.toString()} onValueChange={setYear}>
            <SelectTrigger className="h-9 border-0 bg-transparent font-bold text-base px-1 w-auto">
              <span className="whitespace-nowrap">{currentYear}年</span>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={currentMonthNum.toString()} onValueChange={setMonth}>
            <SelectTrigger className="h-9 border-0 bg-transparent font-bold text-base px-1 w-auto">
              <span className="whitespace-nowrap">{monthOptions[currentMonthNum]}</span>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth(1)}
          className="rounded-full transition-transform active:scale-90"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>


      {/* 图例和说明 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 justify-center">
        {(['menstrual', 'follicular', 'ovulation', 'luteal'] as CyclePhase[]).map((phase) => (
          <div key={phase} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${phaseSolidClass[phase]}`} />
            <span className="text-xs text-muted-foreground">{zh.phases[phase]}</span>
          </div>
        ))}
        
        {/* 预测算法说明 */}
        <Dialog>
          <DialogTrigger asChild>
            <button className="p-1 rounded-full hover:bg-muted transition-colors">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>周期阶段预测说明</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                我们根据您设置的上次经期开始日期和平均周期长度来预测各个阶段：
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-phase-menstrual mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">经期</span>
                    <p className="text-muted-foreground">周期第1-5天（可根据您的记录调整）</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-phase-follicular mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">卵泡期</span>
                    <p className="text-muted-foreground">经期结束后至排卵前2天</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-phase-ovulation mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">排卵期</span>
                    <p className="text-muted-foreground">下次经期前14天左右（±2天）</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-phase-luteal mt-1 shrink-0" />
                  <div>
                    <span className="font-medium">黄体期</span>
                    <p className="text-muted-foreground">排卵后至下次经期开始前</p>
                  </div>
                </div>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  💡 <strong>提高准确性：</strong>坚持每天记录，尤其是经期开始和结束日期。记录越多，预测越准确。
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 日历网格 */}
      <Card 
        key={animationKey} 
        className={`border-0 shadow-lg ${getAnimationClass()}`}
        style={{ 
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <CardContent className="p-3">
          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-2">
            {zh.calendar.weekdays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* 月初之前的空白单元格 */}
            {Array.from({ length: monthData.firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* 日期单元格 */}
            {monthData.days.map((date) => {
              const dateStr = formatDate(date);
              const log = monthData.logMap.get(dateStr);
              const phase = getPhaseForDate(date);
              const isToday = dateStr === today;
              const isPast = date <= new Date();
              // 检查是否是经期（只从 cycles 表获取）
              const isRecordedPeriod = periodDates.has(dateStr);
              const isOvulation = isPast && phase === 'ovulation' && !isRecordedPeriod;
              
              // 计算经期第几天
              let periodDayNum: number | null = null;
              if (isRecordedPeriod) {
                // 找到这段经期的开始日期
                const currentDate = new Date(dateStr);
                let startDate = new Date(dateStr);
                // 向前查找这段经期的开始
                for (let i = 1; i <= 14; i++) {
                  const prevDate = new Date(currentDate);
                  prevDate.setDate(prevDate.getDate() - i);
                  const prevDateStr = formatDate(prevDate);
                  if (periodDates.has(prevDateStr)) {
                    startDate = prevDate;
                  } else {
                    break;
                  }
                }
                periodDayNum = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              }

              // 未来预测样式：虚线边框+淡色背景
              // 未来预测样式：更细更浅的虚线边框
              const futureStyle = phase 
                ? `border border-dashed ${
                    phase === 'menstrual' ? 'border-phase-menstrual/40 bg-phase-menstrual/5' :
                    phase === 'follicular' ? 'border-phase-follicular/40 bg-phase-follicular/5' :
                    phase === 'ovulation' ? 'border-phase-ovulation/40 bg-phase-ovulation/5' :
                    'border-phase-luteal/40 bg-phase-luteal/5'
                  }`
                : '';

              // 确定文字颜色
              const textColorClass = isRecordedPeriod 
                ? 'text-white' 
                : isOvulation 
                  ? 'text-phase-ovulation font-bold' 
                  : 'text-foreground';

              return (
                <button
                  key={dateStr}
                  onClick={() => onDaySelect(dateStr)}
                  className={`aspect-square rounded-full flex flex-col items-center justify-center relative
                    transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isRecordedPeriod
                      ? 'bg-phase-menstrual text-white font-bold shadow-md'
                      : !isPast && phase
                        ? futureStyle
                        : 'bg-muted/30 hover:bg-muted/50'
                  } ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  <span className={`text-sm font-medium ${textColorClass} ${periodDayNum ? 'text-xs' : ''}`}>
                    {date.getDate()}
                  </span>
                  {periodDayNum && (
                    <span className="text-[8px] text-white/90 leading-none font-medium">第{periodDayNum}天</span>
                  )}
                  {log && !isRecordedPeriod && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 图例 */}
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-phase-menstrual shadow-sm" />
          <span className="text-xs text-muted-foreground">已记录经期</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-phase-ovulation">18</span>
          <span className="text-xs text-muted-foreground">排卵期</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-dashed border-phase-menstrual/40 bg-phase-menstrual/5" />
          <span className="text-xs text-muted-foreground">未来预测</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">有记录</span>
        </div>
      </div>

      {/* 回到今天悬浮按钮 */}
      {!isCurrentMonth && (
        <Button
          variant="default"
          size="sm"
          onClick={goToToday}
          className="fixed bottom-24 right-4 rounded-full shadow-lg gap-1.5 animate-fade-in z-10"
        >
          <CalendarDays className="w-4 h-4" />
          今天
        </Button>
      )}
    </div>
  );
}
