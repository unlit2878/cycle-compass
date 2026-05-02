import { ComponentType, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Droplet,
  Pencil,
  Smile,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/AppScaffold';
import { emptyMoodLabel, getNextMoodSelection, moodOptionIcons } from '@/components/mood-options';
import { CycleModel } from '@/lib/cycle-engine';
import {
  CyclePhase,
  findPeriodCycleForDate,
  formatDate,
  getCyclePhase,
  getDayInCycleForDate,
  getDaysSinceBackup,
  getOvulationDay,
  getPhaseName,
  isBackupOverdue,
  parseLocalDate,
} from '@/lib/cycle-utils';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { dateFromISO, formatShortCN, getFlowLabel, moodOptions, weekdayCN } from '@/lib/ui-model';

type IconComponent = ComponentType<{ className?: string }>;

interface HomeProps {
  settings: Settings | null;
  cycleModel: CycleModel | null;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
  onDaySelect: (date: string) => void;
  onMoodSelect: (date: string, mood: string | undefined) => void;
  onBackupReminder: () => void;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function Home({ settings, cycleModel, cycles, dailyLogs, onDaySelect, onMoodSelect, onBackupReminder }: HomeProps) {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const todayStr = formatDate(today);
  const todayLog = dailyLogs.find((log) => log.date === todayStr);
  const latestLog = [...dailyLogs].reverse().find((log) => log.flowIntensity || log.mood || log.symptoms?.length);

  const backupOverdue = useMemo(() => {
    if (!settings) return false;
    return isBackupOverdue(settings.lastBackupDate, settings.backupReminderInterval);
  }, [settings]);

  const daysSinceBackup = useMemo(() => {
    if (!settings) return null;
    const days = getDaysSinceBackup(settings.lastBackupDate);
    return days === Infinity ? null : days;
  }, [settings]);

  const nextStart = cycleModel?.nextPeriodRange?.startDate || null;
  const daysUntil = nextStart
    ? Math.max(0, Math.ceil((nextStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : cycleModel?.currentPhase?.daysUntilNextPeriod || settings?.averageCycleLength || 28;
  const cycleLength = Math.max(1, Math.round(cycleModel?.effectiveCycleLength || settings?.averageCycleLength || 28));
  const currentCycleDay = cycleModel?.currentPhase
    ? ((cycleModel.currentPhase.dayInCycle - 1) % cycleLength + cycleLength) % cycleLength + 1
    : 1;
  const actualPeriodToday = Boolean(cycleModel?.periodDateSet.has(todayStr));
  const expectedStart = cycleModel?.lastPeriodStartDateStr
    ? getMostRecentExpectedStart(cycleModel.lastPeriodStartDateStr, cycleLength, today)
    : null;
  const lateDays = expectedStart && !actualPeriodToday
    ? Math.floor((atNoon(today).getTime() - expectedStart.getTime()) / DAY_MS)
    : null;
  const periodDay = cycleModel?.currentPhase?.phase === 'menstrual'
    ? cycleModel.currentPhase.phaseDay
    : currentCycleDay;
  const heroCopy = getHeroCopy({
    actualPeriodToday,
    lateDays,
    periodDay,
    daysUntil,
    nextStart,
  });
  const heroPhaseName = getHeroPhaseName(
    cycleModel?.currentPhase?.phase,
    cycleModel?.currentPhase?.phaseDay,
    actualPeriodToday
  );

  const fertilityWindow = cycleModel?.nextFertilityWindow || null;

  const statusItems: Array<{ label: string; icon: IconComponent; active: boolean }> = moodOptions.map((label, index) => ({
    label,
    icon: moodOptionIcons[index] || Smile,
    active: todayLog?.mood === label,
  }));
  const latestCycleLabel =
    settings && cycleModel && latestLog
      ? getCycleLabelForDate(latestLog.date, settings, cycleModel, cycles)
      : '';

  if (!settings || !cycleModel) {
    return (
      <PageShell title="早上好" subtitle="每一次记录，都是对自己的关爱" decor="home">
        <div className="empty-state">正在加载你的周期数据...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="早上好"
      subtitle="每一次记录，都是对自己的关爱"
      decor="home"
      className="home-screen"
    >
      {backupOverdue && (
        <button type="button" className="backup-reminder" onClick={onBackupReminder}>
          <span>建议备份数据</span>
          <small>
            {daysSinceBackup === null ? '你还没有备份过' : `上次备份 ${daysSinceBackup} 天前`}，去设置导出备份
          </small>
        </button>
      )}

      <section className="cycle-hero">
        <DottedCycleRing today={today} cycleModel={cycleModel} />
        <div className="cycle-hero-center">
          <span>{heroCopy.label}</span>
          <strong className={heroCopy.compact ? 'compact' : undefined}>
            {heroCopy.value}
            {heroCopy.unit && <small>{heroCopy.unit}</small>}
          </strong>
          {heroCopy.detail && <em>{heroCopy.detail}</em>}
          <button type="button" onClick={() => onDaySelect(todayStr)}>
            记录今天
          </button>
          <div className="hero-phase-summary">
            <b>{heroPhaseName}</b>
          </div>
        </div>
      </section>

      {fertilityWindow && (
        <div className="phase-range-row">
          <div>
            <span>排卵期</span>
            <strong>
              {formatShortCN(fertilityWindow.ovulationRange.startDate).replace('月', '.').replace('日', '')} -{' '}
              {formatShortCN(fertilityWindow.ovulationRange.endDate).replace('月', '.').replace('日', '')}
            </strong>
          </div>
          <div>
            <span>易孕期</span>
            <strong>
              {formatShortCN(fertilityWindow.fertileRange.startDate).replace('月', '.').replace('日', '')} -{' '}
              {formatShortCN(fertilityWindow.fertileRange.endDate).replace('月', '.').replace('日', '')}
            </strong>
          </div>
        </div>
      )}

      <section className="today-status">
        <div className="inline-section-title">
          <h2>今日心情</h2>
          <button type="button" className="icon-action" onClick={() => onDaySelect(todayStr)} aria-label="编辑今日记录">
            <Pencil className="h-5 w-5" />
          </button>
        </div>
        <div className="status-scroll">
          {statusItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`status-chip ${item.active ? 'active' : ''}`}
              aria-pressed={item.active}
              onClick={() => onMoodSelect(todayStr, getNextMoodSelection(todayLog?.mood, item.label))}
            >
              <span>
                <item.icon className="h-6 w-6" />
              </span>
              <small>{item.label}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="care-tip">
        <div className="water-cup" aria-hidden="true" />
        <p>记得保持好心情，<br />多喝水多休息～</p>
        <span className="leaf-mark" />
      </section>

      <section className="recent-record">
        <div className="inline-section-title">
          <h2>最近记录</h2>
          <button type="button" onClick={() => navigate('/calendar')}>
            查看日历
            <span>›</span>
          </button>
        </div>
        {latestLog ? (
          <button type="button" className="recent-card" onClick={() => onDaySelect(latestLog.date)}>
            <div className="recent-date">
              <span>
                {formatShortCN(dateFromISO(latestLog.date))} {weekdayCN(dateFromISO(latestLog.date))}
              </span>
              <small>{latestCycleLabel}</small>
            </div>
            <div className="recent-metrics">
              <Metric icon={Droplet} label="流量" value={getFlowLabel(latestLog.flowIntensity)} />
              <Metric icon={Zap} label="痛经" value={latestLog.symptoms?.[0] || '未记录'} />
              <Metric icon={Smile} label="情绪" value={latestLog.mood || emptyMoodLabel} />
            </div>
          </button>
        ) : (
          <button type="button" className="recent-card empty" onClick={() => onDaySelect(todayStr)}>
            还没有最近记录，今天从一个小状态开始吧。
          </button>
        )}
      </section>
    </PageShell>
  );
}

function DottedCycleRing({
  today,
  cycleModel,
}: {
  today: Date;
  cycleModel: CycleModel;
}) {
  const count = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentIndex = today.getDate() - 1;
  const radius = 126;
  const currentAngle = (currentIndex / count) * Math.PI * 2 - Math.PI / 2;
  const currentX = Math.cos(currentAngle) * radius;
  const currentY = Math.sin(currentAngle) * radius;
  const currentPhase = getPhaseForDate(today, cycleModel);
  const dots = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1, 12);
    const phase = getPhaseForDate(date, cycleModel);
    const wave = Math.sin((index / Math.max(1, count - 1)) * Math.PI);
    const size = 4.5 + wave * 4.5;

    return (
      <i
        key={index}
        className={`phase-${phase}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
        }}
      />
    );
  });

  return (
    <div className="dotted-ring" aria-hidden="true">
      {dots}
      <span
        className={`ring-current-dot phase-${currentPhase}`}
        style={{ transform: `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)` }}
      />
    </div>
  );
}

function getHeroCopy({
  actualPeriodToday,
  lateDays,
  periodDay,
  daysUntil,
  nextStart,
}: {
  actualPeriodToday: boolean;
  lateDays: number | null;
  periodDay: number;
  daysUntil: number;
  nextStart: Date | null;
}) {
  if (actualPeriodToday) {
    return {
      label: '经期第',
      value: String(Math.max(1, periodDay)),
      unit: '天',
      detail: '按今天的感受记录就好',
    };
  }

  if (lateDays !== null && lateDays >= 0) {
    return lateDays === 0
      ? {
          label: '预计今天开始',
          value: '今天',
          unit: '',
          detail: '还没有标记经期开始',
          compact: true,
        }
      : {
          label: '比预计晚了',
          value: String(lateDays),
          unit: '天',
          detail: '还没有标记经期开始',
        };
  }

  return {
    label: '距离下次月经还有',
    value: String(daysUntil),
    unit: '天',
    detail: nextStart ? `预计 ${formatShortCN(nextStart)} ${weekdayCN(nextStart)}` : '',
  };
}

function getHeroPhaseName(
  phase: CyclePhase | undefined,
  phaseDay: number | undefined,
  actualPeriodToday: boolean
) {
  if (!phase) {
    return '周期阶段待完善';
  }

  const phaseName = phase === 'menstrual' && !actualPeriodToday ? '预计经期' : getPhaseName(phase);
  const dayText = phaseDay ? ` · 第 ${Math.max(1, phaseDay)} 天` : '';

  return `${phaseName}${dayText}`;
}

function getCycleLabelForDate(
  dateStr: string,
  settings: Settings,
  cycleModel: CycleModel,
  cycles: CycleData[]
) {
  const recordedCycle = findPeriodCycleForDate(dateStr, cycles);
  if (recordedCycle) {
    const periodDay = Math.floor((parseLocalDate(dateStr).getTime() - parseLocalDate(recordedCycle.startDate).getTime()) / DAY_MS) + 1;
    return `经期第 ${Math.max(1, periodDay)} 天`;
  }

  const anchorStart = getLatestCycleStartOnOrBefore(dateStr, settings, cycles);
  if (!anchorStart) return '周期待完善';

  const dayInCycle = getDayInCycle(dateStr, anchorStart, cycleModel.effectiveCycleLength);
  const phase = getCyclePhase(dayInCycle, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength);
  const phaseDay = getPhaseDayFromCycleDay(dayInCycle, phase, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength);
  const phaseName = phase === 'menstrual' ? '预计经期' : getPhaseName(phase);

  return `${phaseName}第 ${phaseDay} 天`;
}

function getLatestCycleStartOnOrBefore(dateStr: string, settings: Settings, cycles: CycleData[]) {
  const recordedStarts = cycles
    .map((cycle) => cycle.startDate)
    .filter((startDate) => startDate <= dateStr)
    .sort();

  if (recordedStarts.length > 0) return recordedStarts[recordedStarts.length - 1];
  return settings.lastPeriodStart && settings.lastPeriodStart <= dateStr ? settings.lastPeriodStart : settings.lastPeriodStart;
}

function getDayInCycle(dateStr: string, startDateStr: string, cycleLength: number) {
  const diffDays = Math.floor((parseLocalDate(dateStr).getTime() - parseLocalDate(startDateStr).getTime()) / DAY_MS);
  return ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
}

function getPhaseDayFromCycleDay(
  dayInCycle: number,
  phase: CyclePhase,
  cycleLength: number,
  periodLength: number
) {
  const ovulationDay = getOvulationDay(cycleLength);

  switch (phase) {
    case 'menstrual':
      return dayInCycle;
    case 'follicular':
      return Math.max(1, dayInCycle - periodLength);
    case 'ovulation':
      return Math.max(1, dayInCycle - (ovulationDay - 2));
    case 'luteal':
      return Math.max(1, dayInCycle - (ovulationDay + 2));
  }
}

function getPhaseForDate(date: Date, cycleModel: CycleModel): CyclePhase {
  const dateStr = formatDate(date);

  if (cycleModel.periodDateSet.has(dateStr) || cycleModel.predictedPeriodDateSet.has(dateStr)) {
    return 'menstrual';
  }

  if (!cycleModel.lastPeriodStartDate) {
    return 'follicular';
  }

  const dayInCycle = getDayInCycleForDate(date, cycleModel.lastPeriodStartDate, cycleModel.effectiveCycleLength);

  return getCyclePhase(dayInCycle, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength);
}

function getMostRecentExpectedStart(lastPeriodStart: string, cycleLength: number, today: Date): Date | null {
  const todayAtNoon = atNoon(today);
  const expected = parseLocalDate(lastPeriodStart);
  expected.setDate(expected.getDate() + cycleLength);

  if (expected > todayAtNoon) return null;

  while (true) {
    const next = new Date(expected);
    next.setDate(next.getDate() + cycleLength);
    if (next > todayAtNoon) return expected;
    expected.setDate(expected.getDate() + cycleLength);
  }
}

function atNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div>
      <Icon className="h-7 w-7" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
