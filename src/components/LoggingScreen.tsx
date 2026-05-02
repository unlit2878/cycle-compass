import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BatteryLow,
  Bean,
  CirclePlus,
  Droplet,
  Frown,
  Heart,
  Meh,
  Moon,
  RefreshCw,
  Smile,
  SmilePlus,
  Stethoscope,
  Trash2,
  Toilet,
  Waves,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/AppScaffold';
import { emptyMoodLabel, getNextMoodSelection, moodOptionIcons } from '@/components/mood-options';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CycleModel } from '@/lib/cycle-engine';
import { CyclePhase, getCyclePhase, getOvulationDay, parseLocalDate } from '@/lib/cycle-utils';
import { CycleData, DailyLog, FlowColor, FlowIntensity, Settings, getCycleByDate } from '@/lib/db';
import { formatDateCN, flowColorOptions, flowOptions, moodOptions, symptomOptions, weekdayCN } from '@/lib/ui-model';

interface LoggingScreenProps {
  date: string;
  existingLog?: DailyLog;
  settings?: Settings | null;
  cycleModel?: CycleModel | null;
  statistics?: { averagePeriodLength: number };
  onSave: (
    date: string,
    data: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>,
    originalDate: string
  ) => void | Promise<void>;
  onStartPeriod?: (date: string, autoFillDays: number, cycleId?: number) => void | Promise<void>;
  onEndPeriod?: (date: string, cycleId?: number) => void | Promise<void>;
  onBack: () => void;
  onRefresh?: () => void | Promise<void>;
  onDeleteLog?: (date: string) => Promise<void>;
}

type PeriodMarker = 'start' | 'end' | null;

const symptomIcons = [
  Zap,
  Activity,
  Waves,
  Stethoscope,
  Droplet,
  Meh,
  BatteryLow,
  Moon,
  Toilet,
  Frown,
  SmilePlus,
  Bean,
  Waves,
  Frown,
  CirclePlus,
];

export function LoggingScreen({
  date,
  existingLog,
  settings,
  cycleModel,
  statistics,
  onSave,
  onStartPeriod,
  onEndPeriod,
  onBack,
  onRefresh,
  onDeleteLog,
}: LoggingScreenProps) {
  const [relatedCycle, setRelatedCycle] = useState<CycleData | null>(null);
  const [initialCycle, setInitialCycle] = useState<CycleData | null>(null);
  const [periodMarker, setPeriodMarker] = useState<PeriodMarker>(null);
  const [originalPeriodMarker, setOriginalPeriodMarker] = useState<PeriodMarker>(null);
  const [periodActionDirty, setPeriodActionDirty] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | undefined>(existingLog?.flowIntensity);
  const [flowColor, setFlowColor] = useState<FlowColor | undefined>(existingLog?.flowColor || 'deep_red');
  const [flowColorTouched, setFlowColorTouched] = useState(false);
  const [symptoms, setSymptoms] = useState<string[]>(existingLog?.symptoms ?? []);
  const [mood, setMood] = useState<string | undefined>(existingLog?.mood);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  const [deleting, setDeleting] = useState(false);

  const displayDate = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const avgPeriodLength =
    cycleModel?.effectivePeriodLength || statistics?.averagePeriodLength || settings?.averagePeriodLength || 5;
  const dateChanged = selectedDate !== date;
  const visibleCycle = initialCycle && dateChanged ? initialCycle : relatedCycle;
  const activeCycleId = visibleCycle?.id;
  const hasExistingLog = Boolean(
    existingLog?.flowIntensity ||
      existingLog?.flowColor ||
      existingLog?.mood ||
      existingLog?.notes?.trim() ||
      existingLog?.symptoms?.length
  );
  const periodRangeText = visibleCycle
    ? `${formatDateCN(new Date(`${visibleCycle.startDate}T12:00:00`))} - ${
        visibleCycle.endDate ? formatDateCN(new Date(`${visibleCycle.endDate}T12:00:00`)) : '未结束'
      }`
    : null;
  const phaseLabel = getRecordPhaseLabel(selectedDate, visibleCycle, settings, cycleModel);

  useEffect(() => {
    setSelectedDate(date);
    setFlowIntensity(existingLog?.flowIntensity);
    setFlowColor(existingLog?.flowColor || 'deep_red');
    setFlowColorTouched(false);
    setSymptoms(existingLog?.symptoms ?? []);
    setMood(existingLog?.mood);
    setNotes(existingLog?.notes ?? '');
    setPeriodActionDirty(false);
  }, [date, existingLog]);

  useEffect(() => {
    let mounted = true;
    getCycleByDate(date).then((cycle) => {
      if (!mounted) return;
      const marker = getPeriodMarkerForDate(cycle, date);
      setInitialCycle(cycle || null);
      setOriginalPeriodMarker(marker);
      setPeriodMarker(marker);
    });

    return () => {
      mounted = false;
    };
  }, [date]);

  useEffect(() => {
    let mounted = true;
    getCycleByDate(selectedDate).then((cycle) => {
      if (!mounted) return;
      setRelatedCycle(cycle || null);
      if (!(initialCycle && selectedDate !== date)) {
        setPeriodMarker(getPeriodMarkerForDate(cycle, selectedDate));
      }
    });

    return () => {
      mounted = false;
    };
  }, [date, initialCycle, selectedDate]);

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) =>
      current.includes(symptom) ? current.filter((item) => item !== symptom) : [...current, symptom]
    );
  };

  const handleSave = async () => {
    const movingExistingPeriodDate = Boolean(
      initialCycle?.id && dateChanged && originalPeriodMarker && periodMarker === originalPeriodMarker
    );
    const shouldUpdatePeriodStart =
      periodMarker === 'start' && (!relatedCycle || periodActionDirty || movingExistingPeriodDate);
    const shouldUpdatePeriodEnd = periodMarker === 'end' && (periodActionDirty || movingExistingPeriodDate);

    if (shouldUpdatePeriodStart) {
      await onStartPeriod?.(selectedDate, avgPeriodLength, activeCycleId);
    }

    if (shouldUpdatePeriodEnd) {
      await onEndPeriod?.(selectedDate, activeCycleId);
    }

    await onSave(selectedDate, {
      flowIntensity: periodMarker || relatedCycle ? flowIntensity : undefined,
      flowColor: (periodMarker || relatedCycle) && (flowIntensity || flowColorTouched || existingLog?.flowColor)
        ? flowColor
        : undefined,
      symptoms,
      mood: moodOptions.includes(mood || '') ? mood : undefined,
      notes: notes.trim() || undefined,
    }, date);
  };

  const handleDeleteLog = async () => {
    if (!onDeleteLog) return;
    setDeleting(true);
    try {
      await onDeleteLog(date);
      await onRefresh?.();
      toast.success('此日记录已删除');
      onBack();
    } finally {
      setDeleting(false);
    }
  };

  const setMarkerFromUser = (marker: PeriodMarker) => {
    setPeriodMarker((current) => (current === marker && !visibleCycle ? null : marker));
    setPeriodActionDirty(true);
  };

  return (
    <PageShell
      title="记录"
      subtitle="记录每一个瞬间，更了解自己"
      decor="record"
      action={
        <div className="record-header-actions">
          <button type="button" className="soft-pill cancel-pill" onClick={onBack}>
            取消
          </button>
          <button type="button" className="soft-pill save-pill" onClick={handleSave}>
            保存
          </button>
        </div>
      }
      className="record-screen"
    >
      <section className="record-date-block">
        <label className="record-date">
          <span className="record-date-text">
            <strong>{formatDateCN(displayDate)}</strong>
            <em>{weekdayCN(displayDate)}</em>
          </span>
          <span className="record-phase-chip">{phaseLabel}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setPeriodActionDirty(Boolean(initialCycle));
            }}
            aria-label="选择记录日期"
          />
        </label>
      </section>

      {hasExistingLog && (
        <section className="day-log-panel" aria-label="此日记录">
          <div>
            <span>此日记录</span>
            <small>{dateChanged ? `原记录：${formatDateCN(new Date(`${date}T12:00:00`))}` : '已保存过记录'}</small>
          </div>
          <button type="button" className="day-log-icon-button" onClick={() => void onRefresh?.()} aria-label="刷新记录">
            <RefreshCw className="h-4 w-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="day-log-icon-button danger" aria-label="删除此日记录">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="record-confirm-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>删除此日记录？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除 {formatDateCN(new Date(`${date}T12:00:00`))} 的流量、症状、心情和备注。经期开始/结束记录不会被删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteLog} disabled={deleting}>
                  {deleting ? '删除中...' : '确认删除'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      )}

      <section className="record-section">
        <div className="section-title menstrual-title">
          <Droplet className="h-5 w-5" />
          <span>经期记录</span>
        </div>

        {periodRangeText && (
          <div className="period-range-note">
            <span>当前经期</span>
            <strong>{periodRangeText}</strong>
          </div>
        )}

        <div className="period-toggle">
          <button
            type="button"
            className={periodMarker === 'start' ? 'selected' : ''}
            onClick={() => setMarkerFromUser('start')}
          >
            <Droplet className="h-8 w-8" />
            <span>{visibleCycle ? '更新开始' : '标记开始'}</span>
            <small>{visibleCycle ? '将当前经期开始改为所选日期' : '记录经期第一天'}</small>
          </button>
          <button
            type="button"
            className={periodMarker === 'end' ? 'selected muted' : ''}
            onClick={() => setMarkerFromUser('end')}
          >
            <Droplet className="h-8 w-8" />
            <span>经期结束</span>
            <small>{periodRangeText ? '结束上方显示的这段经期' : '记录经期最后一天'}</small>
          </button>
        </div>

        <OptionGrid label="流量" columns={5}>
          {flowOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`circle-option ${flowIntensity === option.value ? 'selected red' : ''}`}
              onClick={() => setFlowIntensity(option.value)}
            >
              <span className="option-icon">
                <Droplet className="h-7 w-7" style={{ color: flowIntensity === option.value ? option.tone : undefined }} />
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </OptionGrid>

        <OptionGrid label="颜色" columns={5}>
          {flowColorOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`circle-option color-option ${flowColor === option.value ? 'selected red' : ''}`}
              onClick={() => {
                setFlowColor(option.value);
                setFlowColorTouched(true);
              }}
            >
              <span className="option-icon">
                <i style={{ backgroundColor: option.color }} />
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </OptionGrid>
      </section>

      <section className="record-section bordered">
        <div className="section-title symptom-title">
          <Heart className="h-5 w-5" />
          <span>症状记录</span>
        </div>
        <div className="icon-grid icon-grid-5 symptom-grid">
          {symptomOptions.map((symptom, index) => {
            const Icon = symptomIcons[index] || Activity;
            const selected = symptoms.includes(symptom);
            return (
              <button
                type="button"
                key={symptom}
                className={`circle-option ${selected ? 'selected lavender' : ''}`}
                onClick={() => toggleSymptom(symptom)}
              >
                <span className="option-icon">
                  <Icon className="h-6 w-6" />
                </span>
                <span>{symptom}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="record-section bordered">
        <div className="section-title mood-title">
          <Smile className="h-5 w-5" />
          <span>心情记录</span>
          <small>{mood || emptyMoodLabel}</small>
        </div>
        <div className="icon-grid icon-grid-5 mood-grid">
          {moodOptions.map((item, index) => {
            const Icon = moodOptionIcons[index] || Smile;
            return (
              <button
                type="button"
                key={item}
                className={`circle-option ${mood === item ? 'selected green' : ''}`}
                aria-pressed={mood === item}
                onClick={() => setMood((current) => getNextMoodSelection(current, item))}
              >
                <span className="option-icon">
                  <Icon className="h-6 w-6" />
                </span>
                <span>{item}</span>
              </button>
            );
          })}
        </div>
      </section>

      <label className="notes-field">
        <span>心情备注（可选）</span>
        <textarea
          maxLength={200}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="写下你的感受..."
        />
        <small>{notes.length}/200</small>
      </label>
    </PageShell>
  );
}

function OptionGrid({ label, columns, children }: { label: string; columns: number; children: ReactNode }) {
  return (
    <div className="record-option-row">
      <span className="record-option-label">{label}</span>
      <div className={`icon-grid icon-grid-${columns}`}>{children}</div>
    </div>
  );
}

function getPeriodMarkerForDate(cycle: CycleData | undefined, date: string): PeriodMarker {
  if (!cycle) return null;
  if (cycle.endDate === date) return 'end';
  return 'start';
}

function getRecordPhaseLabel(
  date: string,
  cycle: CycleData | null,
  settings?: Settings | null,
  cycleModel?: CycleModel | null
) {
  if (cycle) {
    const day = Math.floor((parseLocalDate(date).getTime() - parseLocalDate(cycle.startDate).getTime()) / 86400000) + 1;
    return `经期·第${Math.max(1, day)}天`;
  }

  if (!settings?.lastPeriodStart || !cycleModel) return '周期待完善';

  const dayInCycle = getDayInCycle(date, settings.lastPeriodStart, cycleModel.effectiveCycleLength);
  const phase = getCyclePhase(dayInCycle, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength);

  if (cycleModel.predictedPeriodDateSet.has(date)) {
    return `预计经期·第${Math.max(1, dayInCycle)}天`;
  }

  return `${getPhaseShortName(phase)}·第${getPhaseDay(dayInCycle, phase, cycleModel.effectiveCycleLength, cycleModel.effectivePeriodLength)}天`;
}

function getDayInCycle(date: string, startDate: string, cycleLength: number) {
  const diffDays = Math.floor((parseLocalDate(date).getTime() - parseLocalDate(startDate).getTime()) / 86400000);
  return ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
}

function getPhaseDay(dayInCycle: number, phase: CyclePhase, cycleLength: number, periodLength: number) {
  const ovulationDay = getOvulationDay(cycleLength);

  if (phase === 'menstrual') return dayInCycle;
  if (phase === 'follicular') return Math.max(1, dayInCycle - periodLength);
  if (phase === 'ovulation') return Math.max(1, dayInCycle - (ovulationDay - 2));
  return Math.max(1, dayInCycle - (ovulationDay + 2));
}

function getPhaseShortName(phase: CyclePhase) {
  if (phase === 'menstrual') return '经期';
  if (phase === 'follicular') return '卵泡期';
  if (phase === 'ovulation') return '排卵期';
  return '黄体期';
}
