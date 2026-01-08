import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getDaysInMonth, formatDate, CyclePhase, getCyclePhase } from '@/lib/cycle-utils';
import { DailyLog, Settings } from '@/lib/db';

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
    
    // Create a map of logged days
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

  const today = formatDate(new Date());
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth(-1)}
          className="rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigateMonth(1)}
          className="rounded-full"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 justify-center">
        {(['menstrual', 'follicular', 'ovulation', 'luteal'] as CyclePhase[]).map((phase) => (
          <div key={phase} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${phaseSolidClass[phase]}`} />
            <span className="text-xs text-muted-foreground capitalize">{phase}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-3">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before first of month */}
            {Array.from({ length: monthData.firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
            {monthData.days.map((date) => {
              const dateStr = formatDate(date);
              const log = monthData.logMap.get(dateStr);
              const phase = getPhaseForDate(date);
              const isToday = dateStr === today;
              const isPast = date <= new Date();
              const isRecordedPeriod = log?.isPeriod;

              return (
                <button
                  key={dateStr}
                  onClick={() => onDaySelect(dateStr)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all relative ${
                    isRecordedPeriod
                      ? 'bg-phase-menstrual text-white font-bold'
                      : phase
                        ? `${phaseColorClass[phase]} ${isPast ? 'border-2 border-dashed' : 'border border-dashed opacity-60'}`
                        : 'bg-muted/30'
                  } ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  <span className={isRecordedPeriod ? 'text-white' : 'text-foreground'}>
                    {date.getDate()}
                  </span>
                  {log && !isRecordedPeriod && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend for recorded vs predicted */}
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-phase-menstrual" />
          <span className="text-xs text-muted-foreground">Recorded period</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-dashed border-phase-menstrual bg-phase-menstrual/20" />
          <span className="text-xs text-muted-foreground">Predicted</span>
        </div>
      </div>
    </div>
  );
}
