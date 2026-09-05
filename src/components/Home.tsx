import { ComponentType, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaceSmile } from 'reicon-react';
import { Pen } from 'reicon-react';
import { PageShell } from '@/components/AppScaffold';
import { getNextMoodSelection, moodOptionIcons, noMoodSummaryLabel } from '@/components/mood-options';
import { getFlowSummaryIcon, getMoodSummaryIcon, getPainSummaryIcon, type RecordSummaryIcon } from '@/components/record-icon-maps';
import { CycleModel } from '@/lib/cycle-engine';
import {
  CyclePhase,
  atNoon,
  findPeriodCycleForDate,
  formatDate,
  getCyclePhaseInfoForDate,
  getMostRecentExpectedStart,
  getPhaseName,
  parseLocalDate,
} from '@/lib/cycle-utils';
import { BackupStatus } from '@/lib/backup-status';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { dateFromISO, formatShortCN, getFlowLabel, getRelativeDaysLabel, getPainLevelLabel, moodOptions, weekdayCN } from '@/lib/ui-model';

type IconComponent = ComponentType<{ className?: string }>;

interface HomeProps {
  settings: Settings | null;
  backupStatus: BackupStatus | null;
  cycleModel: CycleModel | null;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
  onDaySelect: (date: string) => void;
  onMoodSelect: (date: string, mood: string | undefined) => void;
  onBackupReminder: () => void;
}

const DAY_MS = 1000 * 60 * 60 * 24;

export function Home({ settings, backupStatus, cycleModel, cycles, dailyLogs, onDaySelect, onMoodSelect, onBackupReminder }: HomeProps) {
  const navigate = useNavigate();
  const today = useCurrentTime();
  const greeting = getTimeGreeting(today);
  const todayStr = formatDate(today);
  const todayLog = dailyLogs.find((log) => log.date === todayStr);
  const latestLog = [...dailyLogs]
    .reverse()
    .find((log) => log.flowIntensity || log.painLevel || log.mood || log.symptoms?.length);

  const nextStart = cycleModel?.nextPeriodRange?.startDate || null;
  // nextStart 由 parseLocalDate 锚在中午，today 却是真实时钟：直接相减会让上午
  // 打开时多出小半天、被 ceil 抬成 +1 天。两端都取中午后差值恰好是整日数，
  // round 只用来吸收夏令时的 ±1 小时。小组件的 dayTable 用的正是同一口径。
  const daysUntil = nextStart
    ? Math.max(0, Math.round((nextStart.getTime() - atNoon(today).getTime()) / DAY_MS))
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

  const statusItems: Array<{ label: string; icon: IconComponent; active: boolean }> = moodOptions.map((label, index) => ({
    label,
    icon: moodOptionIcons[index] || FaceSmile,
    active: todayLog?.mood === label,
  }));
  const latestCycleLabel =
    settings && cycleModel && latestLog
      ? getCycleLabelForDate(latestLog.date, settings, cycleModel, cycles)
      : '';

  if (!settings || !cycleModel) {
    return (
      <PageShell title={greeting} subtitle="每一次记录，都是对自己的关爱" decor="home">
        <div className="empty-state">正在加载你的周期数据...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={greeting}
      subtitle="每一次记录，都是对自己的关爱"
      decor="home"
      className="home-screen"
    >
      {backupStatus?.isOverdue && (
        <button type="button" className="backup-reminder pressable" onClick={onBackupReminder}>
          <span>建议备份数据</span>
          <small>
            {backupStatus.homeReminderText}，去设置导出备份
          </small>
        </button>
      )}

      <section className="cycle-hero">
        <DottedCycleRing today={today} cycleModel={cycleModel} cycles={cycles} />
        <div className="cycle-hero-center">
          <span>{heroCopy.label}</span>
          <strong className={heroCopy.compact ? 'compact' : undefined}>
            {heroCopy.value}
            {heroCopy.unit && <small>{heroCopy.unit}</small>}
          </strong>
          {heroCopy.detail && <em>{heroCopy.detail}</em>}
          <button type="button" className="pressable" onClick={() => onDaySelect(todayStr)}>
            记录今天
          </button>
          <div className="hero-phase-summary">
            <b>{heroPhaseName}</b>
          </div>
        </div>
      </section>

      <section className="today-status">
        <div className="inline-section-title">
          <h2>今日心情</h2>
          <button type="button" className="icon-action icon-pressable" onClick={() => onDaySelect(todayStr)} aria-label="编辑今日记录">
            <Pen className="h-5 w-5" />
          </button>
        </div>
        <div className="status-scroll">
          {statusItems.map((item) => (
            <button
              type="button"
              key={item.label}
              className={`status-chip pressable ${item.active ? 'active' : ''}`}
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
        <img className="water-cup" src="/decor/02_water_glass.png" alt="" aria-hidden="true" />
        <p>记得保持好心情，<br />多喝水多休息～</p>
        <img className="leaf-mark" src="/decor/03_leaf_branch.png" alt="" aria-hidden="true" />
      </section>

      <section className="recent-record">
        <div className="inline-section-title">
          <h2>最近记录</h2>
          <button type="button" className="pressable" onClick={() => navigate('/calendar')}>
            查看日历
            <span>›</span>
          </button>
        </div>
        {latestLog ? (
          <button type="button" className="recent-card pressable" onClick={() => onDaySelect(latestLog.date)}>
            <div className="recent-date">
              <span>
                {formatShortCN(dateFromISO(latestLog.date))} {weekdayCN(dateFromISO(latestLog.date))}
                <em className="recent-ago">· {getRelativeDaysLabel(dateFromISO(latestLog.date), today)}</em>
              </span>
              <small>{latestCycleLabel}</small>
            </div>
            <div className="recent-metrics">
              <Metric icon={getFlowSummaryIcon(latestLog.flowIntensity)} label="流量" value={getFlowLabel(latestLog.flowIntensity)} />
              <Metric icon={getPainSummaryIcon(latestLog.painLevel)} label="疼痛" value={getPainLevelLabel(latestLog.painLevel)} />
              <Metric icon={getMoodSummaryIcon(latestLog.mood)} label="情绪" value={latestLog.mood || noMoodSummaryLabel} />
            </div>
          </button>
        ) : (
          <button type="button" className="recent-card empty pressable" onClick={() => onDaySelect(todayStr)}>
            还没有最近记录，今天从一个小状态开始吧。
          </button>
        )}
      </section>
    </PageShell>
  );
}

function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(timer);
  }, []);

  return currentTime;
}

function getTimeGreeting(date: Date) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 11) return '早上好';
  if (hour >= 11 && hour < 14) return '中午好';
  if (hour >= 14 && hour < 18) return '下午好';
  return '晚上好';
}

function DottedCycleRing({
  today,
  cycleModel,
  cycles,
}: {
  today: Date;
  cycleModel: CycleModel;
  cycles: CycleData[];
}) {
  const count = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentIndex = today.getDate() - 1;
  const radius = 126;
  const currentAngle = (currentIndex / count) * Math.PI * 2 - Math.PI / 2;
  const currentX = Math.cos(currentAngle) * radius;
  const currentY = Math.sin(currentAngle) * radius;
  const currentPhase = getPhaseForDate(today, cycleModel, cycles);
  const dots = Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const date = new Date(today.getFullYear(), today.getMonth(), index + 1, 12);
    const phase = getPhaseForDate(date, cycleModel, cycles);
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

  const phaseInfo = getCyclePhaseInfoForDate(parseLocalDate(dateStr), {
    cycles,
    lastPeriodStart: settings.lastPeriodStart,
    cycleLength: cycleModel.effectiveCycleLength,
    periodLength: cycleModel.effectivePeriodLength,
    predictedPeriodDateSet: cycleModel.predictedPeriodDateSet,
  });
  if (!phaseInfo) return '周期待完善';

  const phaseName = phaseInfo.phase === 'menstrual' && !phaseInfo.isRecordedPeriod ? '预计经期' : getPhaseName(phaseInfo.phase);

  return `${phaseName}第 ${phaseInfo.phaseDay} 天`;
}

function getPhaseForDate(date: Date, cycleModel: CycleModel, cycles: CycleData[]): CyclePhase {
  if (!cycleModel.lastPeriodStartDate) {
    return 'follicular';
  }

  return getCyclePhaseInfoForDate(date, {
    cycles,
    lastPeriodStart: cycleModel.lastPeriodStartDateStr,
    cycleLength: cycleModel.effectiveCycleLength,
    periodLength: cycleModel.effectivePeriodLength,
    predictedPeriodDateSet: cycleModel.predictedPeriodDateSet,
  })?.phase || 'follicular';
}

function Metric({ icon: Icon, label, value }: { icon: RecordSummaryIcon; label: string; value: string }) {
  return (
    <div>
      <Icon className="h-7 w-7" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
