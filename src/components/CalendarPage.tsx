import { ComponentType, TouchEvent, useCallback, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Droplet,
  HelpCircle,
  Pencil,
  Smile,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/AppScaffold';
import { getNextMoodSelection, moodOptionIcons } from '@/components/mood-options';
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
} from '@/components/ui/select';
import { CycleModel } from '@/lib/cycle-engine';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import {
  CyclePhase,
  formatDate,
  getCyclePhase,
  getCycleWindowKindForDay,
  getDayInCycleForDate,
  getDaysInMonth,
  getOrdinalSuffix,
} from '@/lib/cycle-utils';
import { getFlowLabel, moodOptions, weekdayCN, weekdayShortCN } from '@/lib/ui-model';

type IconComponent = ComponentType<{ className?: string }>;

interface CalendarPageProps {
  settings: Settings | null;
  dailyLogs: DailyLog[];
  cycles: CycleData[];
  cycleModel: CycleModel | null;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onDaySelect: (date: string) => void;
  onMoodSelect: (date: string, mood: string | undefined) => void;
}

export function CalendarPage({
  dailyLogs,
  cycleModel,
  currentMonth,
  onMonthChange,
  onDaySelect,
  onMoodSelect,
}: CalendarPageProps) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | 'scale' | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const logMap = useMemo(() => new Map(dailyLogs.map((log) => [log.date, log])), [dailyLogs]);
  const periodDates = cycleModel?.periodDateSet || new Set<string>();
  const todayStr = formatDate(new Date());
  const currentYear = currentMonth.getFullYear();
  const currentMonthIndex = currentMonth.getMonth();
  const currentMonthIsToday =
    new Date().getFullYear() === currentYear && new Date().getMonth() === currentMonthIndex;
  const yearOptions = useMemo(
    () => Array.from({ length: 11 }, (_, index) => new Date().getFullYear() - 5 + index),
    []
  );
  const monthOptions = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const prev: Array<{ date: Date; current: boolean }> = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      prev.push({ date: new Date(year, month, -i), current: false });
    }

    const current = getDaysInMonth(year, month).map((date) => ({ date, current: true }));
    const nextCount = 42 - prev.length - current.length;
    const next = Array.from({ length: nextCount }, (_, index) => ({
      date: new Date(year, month + 1, index + 1),
      current: false,
    }));

    return [...prev, ...current, ...next];
  }, [currentMonth]);

  const selectedLog = logMap.get(selectedDate);
  const selected = new Date(`${selectedDate}T12:00:00`);
  const statusItems: Array<{ label: string; icon: IconComponent; active: boolean }> = moodOptions.map((label, index) => ({
    label,
    icon: moodOptionIcons[index] || Smile,
    active: selectedLog?.mood === label,
  }));

  const goMonth = useCallback((delta: number) => {
    setSlideDirection(delta > 0 ? 'left' : 'right');
    setAnimationKey((value) => value + 1);
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + delta);
    onMonthChange(next);
  }, [currentMonth, onMonthChange]);

  function getPhaseForDate(date: Date): CyclePhase | null {
    if (!cycleModel?.lastPeriodStartDate) return null;
    const dateStr = formatDate(date);
    if (periodDates.has(dateStr) || cycleModel.predictedPeriodDateSet.has(dateStr)) return 'menstrual';

    const dayInCycle = getDayInCycleForDate(date, cycleModel.lastPeriodStartDate, cycleModel.effectiveCycleLength);
    return getCyclePhase(dayInCycle, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength);
  }

  const setYear = (value: string) => {
    const next = new Date(currentMonth);
    next.setFullYear(Number(value));
    setSlideDirection(Number(value) > currentYear ? 'left' : 'right');
    setAnimationKey((key) => key + 1);
    onMonthChange(next);
  };

  const setMonth = (value: string) => {
    const next = new Date(currentMonth);
    next.setMonth(Number(value));
    setSlideDirection(Number(value) > currentMonthIndex ? 'left' : 'right');
    setAnimationKey((key) => key + 1);
    onMonthChange(next);
  };

  const goToday = () => {
    const today = new Date();
    setSelectedDate(formatDate(today));
    setSlideDirection('scale');
    setAnimationKey((key) => key + 1);
    onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const getAnimationClass = () => {
    if (!slideDirection || isSwiping) return '';
    if (slideDirection === 'left') return 'calendar-slide-left';
    if (slideDirection === 'right') return 'calendar-slide-right';
    return 'calendar-slide-enter';
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    touchStartY.current = event.touches[0].clientY;
    touchEndX.current = event.touches[0].clientX;
    touchEndY.current = event.touches[0].clientY;
    setIsSwiping(true);
    setSwipeOffset(0);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!isSwiping) return;
    touchEndX.current = event.touches[0].clientX;
    touchEndY.current = event.touches[0].clientY;

    const diffX = touchEndX.current - touchStartX.current;
    const diffY = Math.abs(touchEndY.current - touchStartY.current);

    if (Math.abs(diffX) > diffY) {
      event.preventDefault();
      const maxOffset = 120;
      setSwipeOffset(Math.sign(diffX) * Math.min(Math.abs(diffX) * 0.5, maxOffset));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    setIsSwiping(false);

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = Math.abs(touchStartY.current - touchEndY.current);

    if (Math.abs(diffX) > 80 && Math.abs(diffX) > diffY * 1.5) {
      goMonth(diffX > 0 ? 1 : -1);
    }

    setSwipeOffset(0);
  };

  const getPeriodDay = (date: Date) => {
    const dateStr = formatDate(date);
    if (!periodDates.has(dateStr)) return null;
    const cycleStart = findRecordedPeriodStart(date, periodDates);
    return Math.floor((atNoon(date).getTime() - cycleStart.getTime()) / 86400000) + 1;
  };

  const isInFertileWindow = (date: Date) => {
    if (!cycleModel?.lastPeriodStartDate) return false;
    const dateStr = formatDate(date);
    if (periodDates.has(dateStr) || cycleModel.predictedPeriodDateSet.has(dateStr)) return false;

    const dayInCycle = getDayInCycleForDate(date, cycleModel.lastPeriodStartDate, cycleModel.effectiveCycleLength);
    return getCycleWindowKindForDay(dayInCycle, cycleModel.effectiveCycleLength) === 'fertile';
  };

  return (
    <PageShell
      title="日历"
      subtitle="记录每一次变化，了解自己的节奏"
      decor="calendar"
      className="calendar-screen"
    >
      <div className="calendar-month-control">
        <button type="button" onClick={() => goMonth(-1)} aria-label="上个月">
          <ChevronLeft />
        </button>
        <div className="calendar-selectors">
          <Select value={String(currentYear)} onValueChange={setYear}>
            <SelectTrigger className="calendar-select-trigger" aria-label="选择年份">
              <span>{currentYear}年</span>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(currentMonthIndex)} onValueChange={setMonth}>
            <SelectTrigger className="calendar-select-trigger month" aria-label="选择月份">
              <span>{monthOptions[currentMonthIndex]}</span>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month, index) => (
                <SelectItem key={month} value={String(index)}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button type="button" onClick={() => goMonth(1)} aria-label="下个月">
          <ChevronRight />
        </button>
      </div>

      <div
        key={animationKey}
        className={`calendar-grid-wrap ${getAnimationClass()}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : undefined,
          touchAction: 'pan-y',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
          <div className="weekday-grid">
            {Array.from({ length: 7 }, (_, index) => {
              const d = new Date(2024, 5, 2 + index);
              return <span key={index}>{weekdayShortCN(d)}</span>;
            })}
          </div>
          <div className="calendar-grid">
            {calendarDays.map(({ date, current }) => {
              const dateStr = formatDate(date);
              const phase = getPhaseForDate(date);
              const log = logMap.get(dateStr);
              const selectedCell = dateStr === selectedDate;
              const isRecordedPeriod = periodDates.has(dateStr);
              const isPredictedPeriod = cycleModel?.predictedPeriodDateSet.has(dateStr) && !isRecordedPeriod;
              const isOvulation = phase === 'ovulation' && !isRecordedPeriod && current;
              const isFertile = isInFertileWindow(date) && !isOvulation && current;
              const periodDay = getPeriodDay(date);

              return (
                <button
                  type="button"
                  key={dateStr}
                  className={[
                    'calendar-day',
                    current ? '' : 'muted',
                    selectedCell ? 'selected' : '',
                    isRecordedPeriod ? 'period' : '',
                    isPredictedPeriod ? 'predicted-period' : '',
                    isOvulation ? 'ovulation' : '',
                  ].join(' ')}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    onDaySelect(dateStr);
                  }}
                >
                  <span>{date.getDate()}</span>
                  {periodDay && <small>{getOrdinalSuffix(periodDay)}</small>}
                  {isFertile && <i className="fertile-dot" />}
                  {log && <i className="log-dot" />}
                </button>
              );
            })}
          </div>
      </div>

      <div className="calendar-legend">
        <span><i className="legend-period" />经期</span>
        <span><i className="legend-ovulation" />排卵期</span>
        <span><i className="legend-fertile" />易孕期</span>
        <span><i className="legend-predicted" />预测经期</span>
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="calendar-help" aria-label="周期阶段预测说明">
              <HelpCircle className="h-4 w-4" />
            </button>
          </DialogTrigger>
          <DialogContent className="phase-help-dialog">
            <DialogHeader>
              <DialogTitle>周期阶段预测说明</DialogTitle>
            </DialogHeader>
            <div className="phase-help-content">
              <p>根据你的经期记录、平均周期长度和经期长度预测不同阶段。记录越完整，预测越稳定。</p>
              <PhaseHelpDot phase="menstrual" title="经期" text="已记录经期优先显示；未来经期使用淡色虚线标记。" />
              <PhaseHelpDot phase="follicular" title="卵泡期" text="经期结束后到排卵窗口前的阶段。" />
              <PhaseHelpDot phase="ovulation" title="排卵期" text="通常在下次经期前约 14 天，前后会有浮动。" />
              <PhaseHelpDot phase="luteal" title="易孕期" text="围绕排卵日前后的可孕窗口，日历用小圆点提示。" />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <button
        type="button"
        className={`detail-caret ${detailExpanded ? 'expanded' : ''}`}
        aria-expanded={detailExpanded}
        aria-label={detailExpanded ? '收起当日详情' : '展开当日详情'}
        onClick={() => setDetailExpanded((expanded) => !expanded)}
      >
        {detailExpanded ? '^' : '⌄'}
      </button>

      {detailExpanded && <section className="calendar-detail">
        <div className="calendar-detail-head">
          <div>
            <strong>{selected.getMonth() + 1}月{selected.getDate()}日</strong>
            <span>{weekdayCN(selected)}</span>
          </div>
          <button type="button" onClick={() => onDaySelect(selectedDate)} aria-label="编辑记录">
            <Pencil className="h-5 w-5" />
          </button>
        </div>

        <div className="calendar-summary-metrics">
          <SummaryMetric icon={Droplet} label="流量" value={getFlowLabel(selectedLog?.flowIntensity)} />
          <SummaryMetric icon={Zap} label="痛经" value={selectedLog?.symptoms?.[0] || '未记录'} />
          <SummaryMetric icon={Smile} label="情绪" value={selectedLog?.mood || '未记录'} />
        </div>

        <div className="today-status compact">
          <div className="inline-section-title">
            <h2>当日心情</h2>
          </div>
          <div className="status-scroll">
            {statusItems.map(({ label, icon: Icon, active }) => (
              <button
                type="button"
                key={label}
                className={`status-chip ${active ? 'active' : ''}`}
                aria-pressed={active}
                onClick={() => onMoodSelect(selectedDate, getNextMoodSelection(selectedLog?.mood, label))}
              >
                <span>
                  <Icon className="h-6 w-6" />
                </span>
                <small>{label}</small>
              </button>
            ))}
          </div>
        </div>
      </section>}

      {!currentMonthIsToday && (
        <button type="button" className="calendar-today-fab" onClick={goToday}>
          <CalendarDays className="h-4 w-4" />
          今天
        </button>
      )}
    </PageShell>
  );
}

function findRecordedPeriodStart(date: Date, periodDates: Set<string>) {
  const current = atNoon(date);
  const start = atNoon(date);

  for (let index = 1; index <= 14; index++) {
    const previous = new Date(current);
    previous.setDate(previous.getDate() - index);
    if (!periodDates.has(formatDate(previous))) break;
    start.setTime(previous.getTime());
  }

  return start;
}

function atNoon(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function PhaseHelpDot({ phase, title, text }: { phase: CyclePhase; title: string; text: string }) {
  return (
    <div className="phase-help-row">
      <i className={`legend-${phase === 'menstrual' ? 'period' : phase === 'ovulation' ? 'ovulation' : 'fertile'}`} />
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <Icon className="h-8 w-8" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
