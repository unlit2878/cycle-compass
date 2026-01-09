import { useState, useMemo } from 'react';
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
import { DailyLog, Settings } from '@/lib/db';
import { zh, formatMonthYear } from '@/lib/i18n';

interface CalendarPageProps {
  settings: Settings | null;
  dailyLogs: DailyLog[];
  onDaySelect: (date: string) => void;
}

export function CalendarPage({ settings, dailyLogs, onDaySelect }: CalendarPageProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const getPhaseForDate = (date: Date): CyclePhase | null => {
    if (!settings?.lastPeriodStart) return null;
    
    const lastStart = new Date(settings.lastPeriodStart);
    const diffDays = Math.floor((date.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return null;
    
    const dayInCycle = (diffDays % settings.averageCycleLength) + 1;
    return getCyclePhase(dayInCycle, settings.averageCycleLength);
  };

  const phaseColorClass: Record<CyclePhase, string> = {
    menstrual: 'bg-phase-menstrual/20 border-phase-menstrual',
    follicular: 'bg-phase-follicular/20 border-phase-follicular',
    ovulation: 'bg-phase-ovulation/20 border-phase-ovulation',
    luteal: 'bg-phase-luteal/20 border-phase-luteal',
  };

  const phaseSolidClass: Record<CyclePhase, string> = {
    menstrual: 'bg-phase-menstrual text-white',
    follicular: 'bg-phase-follicular text-white',
    ovulation: 'bg-phase-ovulation text-white',
    luteal: 'bg-phase-luteal text-white',
  };

  const navigateMonth = (delta: number) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentMonth(newDate);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const setYear = (year: string) => {
    const newDate = new Date(currentMonth);
    newDate.setFullYear(parseInt(year));
    setCurrentMonth(newDate);
  };

  const setMonth = (month: string) => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(parseInt(month));
    setCurrentMonth(newDate);
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
        
        <div className="flex items-center gap-1">
          <Select value={currentYear.toString()} onValueChange={setYear}>
            <SelectTrigger className="w-[72px] h-9 border-0 bg-transparent font-bold text-base px-2">
              <SelectValue>{currentYear}年</SelectValue>
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
            <SelectTrigger className="w-[68px] h-9 border-0 bg-transparent font-bold text-base px-2">
              <SelectValue>{monthOptions[currentMonthNum]}</SelectValue>
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

      {/* 回到今天按钮 */}
      {!isCurrentMonth && (
        <div className="flex justify-center mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="rounded-full gap-1.5 animate-fade-in"
          >
            <CalendarDays className="w-4 h-4" />
            回到今天
          </Button>
        </div>
      )}

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
      <Card className="border-0 shadow-lg">
        <CardContent className="p-2">
          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-1">
            {zh.calendar.weekdays.map((day) => (
              <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-0.5">
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
              const isRecordedPeriod = log?.isPeriod;
              
              // 计算经期第几天
              let periodDayNum: number | null = null;
              if (isRecordedPeriod && settings?.lastPeriodStart) {
                // 找到这段经期的开始日期
                const currentDate = new Date(dateStr);
                let startDate = new Date(dateStr);
                // 向前查找这段经期的开始
                for (let i = 1; i <= 14; i++) {
                  const prevDate = new Date(currentDate);
                  prevDate.setDate(prevDate.getDate() - i);
                  const prevDateStr = formatDate(prevDate);
                  const prevLog = monthData.logMap.get(prevDateStr);
                  if (prevLog?.isPeriod) {
                    startDate = prevDate;
                  } else {
                    break;
                  }
                }
                periodDayNum = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              }

              return (
                <button
                  key={dateStr}
                  onClick={() => onDaySelect(dateStr)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative
                    transition-all duration-200 hover:scale-105 active:scale-95 ${
                    isRecordedPeriod
                      ? 'bg-phase-menstrual text-white font-bold shadow-md'
                      : phase
                        ? `${phaseColorClass[phase]} ${isPast ? 'border border-dashed' : 'border border-dashed opacity-60'}`
                        : 'bg-muted/30 hover:bg-muted/50'
                  } ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  <span className={`${isRecordedPeriod ? 'text-white' : 'text-foreground'} ${periodDayNum ? 'text-[10px]' : ''}`}>
                    {date.getDate()}
                  </span>
                  {periodDayNum && (
                    <span className="text-[8px] text-white/80 leading-none">第{periodDayNum}天</span>
                  )}
                  {log && !isRecordedPeriod && (
                    <div className="w-1 h-1 rounded-full bg-primary absolute bottom-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 已记录与预测图例 */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-phase-menstrual" />
          <span className="text-xs text-muted-foreground">已记录经期</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-dashed border-phase-menstrual bg-phase-menstrual/20" />
          <span className="text-xs text-muted-foreground">预测</span>
        </div>
      </div>
    </div>
  );
}
