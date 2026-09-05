import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Ban,
  Bolt,
  CalendarMark as PeriodStartIcon,
  CalendarX as PeriodEndIcon,
  Check,
  Drop,
  Droplet,
  Drops,
  Hiking3 as WaistSorenessIcon,
  Heart,
  HeartPulse as BreastPainIcon,
  Loader,
  FaceSmile,
  Trash2,
  UserX3 as HeadacheIcon,
  AlertTriangle,
} from 'reicon-react';
import { toast } from 'sonner';
import { PageShell } from '@/components/AppScaffold';
import { emptyMoodLabel, getNextMoodSelection, moodOptionIcons } from '@/components/mood-options';
import {
  AcneIcon,
  BloatingIcon,
  ConstipationIcon,
  DiarrheaIcon,
  FlowMediumIcon,
  FlowVeryHeavyIcon,
  NauseaIcon,
  PainModerateIcon,
  PainSevereIcon,
} from '@/components/reicon-custom-icons';
import { AppetiteIcon, EdemaIcon, FatigueIcon, InsomniaIcon } from '@/components/record-icons';
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
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { MOTION } from '@/lib/animation';
import { CyclePhase, getCyclePhaseInfoForDate, parseLocalDate } from '@/lib/cycle-utils';
import { CycleData, DailyLog, FlowColor, FlowIntensity, PainLevel, Settings, getCycleByDate } from '@/lib/db';
import {
  formatDateCN,
  flowColorOptions,
  flowOptions,
  moodOptions,
  painOptions,
  symptomOptions,
  weekdayCN,
} from '@/lib/ui-model';

interface LoggingScreenProps {
  date: string;
  existingLog?: DailyLog;
  cycles: CycleData[];
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
  onDeletePeriod?: (cycleId: number) => void | Promise<void>;
  onBack: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  closeRequestSignal?: number;
  onKeepEditing?: () => void;
  onRefresh?: () => void | Promise<void>;
  onDeleteLog?: (date: string) => Promise<void>;
}

type PeriodMarker = 'start' | 'end' | null;
type SaveState = 'idle' | 'loading' | 'success' | 'error';

const symptomIcons = [
  WaistSorenessIcon,
  BloatingIcon,
  HeadacheIcon,
  BreastPainIcon,
  FatigueIcon,
  InsomniaIcon,
  ConstipationIcon,
  DiarrheaIcon,
  AcneIcon,
  AppetiteIcon,
  EdemaIcon,
  NauseaIcon,
];

const visibleSymptomSet = new Set(symptomOptions);

function cleanVisibleSymptoms(items: string[] = []) {
  return items.filter((item) => visibleSymptomSet.has(item));
}

function getSaveLabel(state: SaveState) {
  if (state === 'loading') return '保存中';
  if (state === 'success') return '已保存';
  if (state === 'error') return '重试';
  return '保存';
}

export function LoggingScreen({
  date,
  existingLog,
  cycles,
  settings,
  cycleModel,
  statistics,
  onSave,
  onStartPeriod,
  onEndPeriod,
  onDeletePeriod,
  onBack,
  onDirtyChange,
  closeRequestSignal,
  onKeepEditing,
  onRefresh,
  onDeleteLog,
}: LoggingScreenProps) {
  const reducedMotion = useReducedMotionPreference();
  const [relatedCycle, setRelatedCycle] = useState<CycleData | null>(null);
  const [initialCycle, setInitialCycle] = useState<CycleData | null>(null);
  const [periodMarker, setPeriodMarker] = useState<PeriodMarker>(null);
  const [originalPeriodMarker, setOriginalPeriodMarker] = useState<PeriodMarker>(null);
  const [periodActionDirty, setPeriodActionDirty] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);
  const [flowIntensity, setFlowIntensity] = useState<FlowIntensity | undefined>(existingLog?.flowIntensity);
  const [flowColor, setFlowColor] = useState<FlowColor | undefined>(existingLog?.flowColor);
  const [flowColorTouched, setFlowColorTouched] = useState(false);
  const [painLevel, setPainLevel] = useState<PainLevel | undefined>(existingLog?.painLevel);
  const [symptoms, setSymptoms] = useState<string[]>(cleanVisibleSymptoms(existingLog?.symptoms));
  const [mood, setMood] = useState<string | undefined>(existingLog?.mood);
  const [notes, setNotes] = useState(existingLog?.notes ?? '');
  const [deleting, setDeleting] = useState(false);
  const [deletePeriodDialogOpen, setDeletePeriodDialogOpen] = useState(false);
  const [deletingPeriod, setDeletingPeriod] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const [savingFromPrompt, setSavingFromPrompt] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCloseRequestSignal = useRef(closeRequestSignal);

  const displayDate = useMemo(() => new Date(`${selectedDate}T12:00:00`), [selectedDate]);
  const avgPeriodLength =
    cycleModel?.effectivePeriodLength || statistics?.averagePeriodLength || settings?.averagePeriodLength || 5;
  const dateChanged = selectedDate !== date;
  const visibleCycle = initialCycle && dateChanged ? initialCycle : relatedCycle;
  const activeCycleId = visibleCycle?.id;
  const hasExistingLog = Boolean(
    existingLog?.flowIntensity ||
      existingLog?.flowColor ||
      existingLog?.painLevel ||
      existingLog?.mood ||
      existingLog?.notes?.trim() ||
      existingLog?.symptoms?.length
  );
  const periodRangeText = visibleCycle
    ? `${formatDateCN(new Date(`${visibleCycle.startDate}T12:00:00`))} - ${
        visibleCycle.endDate ? formatDateCN(new Date(`${visibleCycle.endDate}T12:00:00`)) : '未结束'
      }`
    : null;
  const phaseLabel = getRecordPhaseLabel(selectedDate, visibleCycle, cycles, settings, cycleModel);
  const hasUnsavedChanges = useMemo(() => {
    const initialSymptoms = cleanVisibleSymptoms(existingLog?.symptoms);
    return (
      selectedDate !== date ||
      periodActionDirty ||
      periodMarker !== originalPeriodMarker ||
      flowIntensity !== existingLog?.flowIntensity ||
      flowColor !== existingLog?.flowColor ||
      painLevel !== existingLog?.painLevel ||
      mood !== existingLog?.mood ||
      notes !== (existingLog?.notes ?? '') ||
      cleanVisibleSymptoms(symptoms).join('|') !== initialSymptoms.join('|')
    );
  }, [
    date,
    existingLog?.flowColor,
    existingLog?.flowIntensity,
    existingLog?.mood,
    existingLog?.notes,
    existingLog?.painLevel,
    existingLog?.symptoms,
    flowColor,
    flowIntensity,
    mood,
    notes,
    originalPeriodMarker,
    painLevel,
    periodActionDirty,
    periodMarker,
    selectedDate,
    symptoms,
  ]);

  useEffect(() => {
    setSelectedDate(date);
    setFlowIntensity(existingLog?.flowIntensity);
    setFlowColor(existingLog?.flowColor);
    setFlowColorTouched(false);
    setPainLevel(existingLog?.painLevel);
    setSymptoms(cleanVisibleSymptoms(existingLog?.symptoms));
    setMood(existingLog?.mood);
    setNotes(existingLog?.notes ?? '');
    setPeriodActionDirty(false);
  }, [date, existingLog]);

  useEffect(() => {
    const textarea = notesTextareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(140, textarea.scrollHeight)}px`;
  }, [notes]);

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    if (closeRequestSignal === undefined || closeRequestSignal === lastCloseRequestSignal.current) return;
    lastCloseRequestSignal.current = closeRequestSignal;
    if (hasUnsavedChanges) {
      setUnsavedDialogOpen(true);
    } else {
      onBack();
    }
  }, [closeRequestSignal, hasUnsavedChanges, onBack]);

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
    if (saveState === 'loading' || saveState === 'success') return false;
    setSaveState('loading');

    try {
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
        painLevel,
        symptoms: cleanVisibleSymptoms(symptoms),
        mood: moodOptions.includes(mood || '') ? mood : undefined,
        notes: notes.trim() || undefined,
      }, date);
      onDirtyChange?.(false);
      setSaveState('success');
      if (!reducedMotion) {
        await new Promise((resolve) => window.setTimeout(resolve, MOTION.standardMs));
      }
      onBack();
      return true;
    } catch {
      setSaveState('error');
      toast.error('保存失败，请重试');
      return false;
    }
  };

  const requestBack = () => {
    if (hasUnsavedChanges) {
      setUnsavedDialogOpen(true);
      return;
    }
    onBack();
  };

  const handleSaveFromPrompt = async () => {
    setSavingFromPrompt(true);
    try {
      await handleSave();
    } finally {
      setSavingFromPrompt(false);
    }
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

  const handleDeletePeriod = async () => {
    if (!activeCycleId || !onDeletePeriod) return;
    setDeletingPeriod(true);
    try {
      await onDeletePeriod(activeCycleId);
      setDeletePeriodDialogOpen(false);
      setRelatedCycle((cycle) => (cycle?.id === activeCycleId ? null : cycle));
      setInitialCycle((cycle) => (cycle?.id === activeCycleId ? null : cycle));
      setPeriodMarker(null);
      setOriginalPeriodMarker((marker) => (initialCycle?.id === activeCycleId ? null : marker));
      setPeriodActionDirty(false);
    } finally {
      setDeletingPeriod(false);
    }
  };

  const setMarkerFromUser = (marker: PeriodMarker) => {
    if (
      marker === 'start' &&
      periodMarker === 'start' &&
      visibleCycle?.id &&
      visibleCycle.startDate === selectedDate &&
      onDeletePeriod
    ) {
      setDeletePeriodDialogOpen(true);
      return;
    }

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
          <button type="button" className="soft-pill cancel-pill pressable" onClick={requestBack}>
            取消
          </button>
          <button
            type="button"
            className="soft-pill save-pill pressable"
            data-save-state={saveState}
            disabled={saveState === 'loading' || saveState === 'success'}
            onClick={handleSave}
          >
            {saveState === 'loading' && <Loader className="save-state-icon is-loading" aria-hidden="true" />}
            {saveState === 'success' && <Check className="save-state-icon" aria-hidden="true" />}
            {saveState === 'error' && <AlertTriangle className="save-state-icon" aria-hidden="true" />}
            <span key={saveState} className="save-pill-label" aria-live="polite">
              {getSaveLabel(saveState)}
            </span>
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="day-log-icon-button danger icon-pressable" aria-label="删除此日记录">
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
              <AlertDialogFooter className="record-confirm-actions">
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction className="record-danger-action" onClick={handleDeleteLog} disabled={deleting}>
                  {deleting ? '删除中...' : '删除'}
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
            className={`pressable ${periodMarker === 'start' ? 'selected' : ''}`}
            onClick={() => setMarkerFromUser('start')}
          >
            <PeriodStartIcon className="h-8 w-8" />
            <span>{visibleCycle ? '更新开始' : '标记开始'}</span>
            <small>{visibleCycle ? '将当前经期开始改为所选日期' : '记录经期第一天'}</small>
          </button>
          <button
            type="button"
            className={`pressable ${periodMarker === 'end' ? 'selected muted' : ''}`}
            onClick={() => setMarkerFromUser('end')}
          >
            <PeriodEndIcon className="h-8 w-8" />
            <span>经期结束</span>
            <small>{periodRangeText ? '结束上方显示的这段经期' : '记录经期最后一天'}</small>
          </button>
        </div>

        <OptionGrid label="流量" columns={5}>
          {flowOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`circle-option pressable ${flowIntensity === option.value ? 'selected red' : ''}`}
              onClick={() => setFlowIntensity(option.value)}
            >
              <span className="option-icon">
                <FlowIntensityIcon intensity={option.value} selected={flowIntensity === option.value} />
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
              className={`circle-option color-option pressable ${flowColor === option.value ? 'selected red' : ''}`}
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

        <OptionGrid label="疼痛" columns={4}>
          {painOptions.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`circle-option pressable ${painLevel === option.value ? 'selected lavender' : ''}`}
              onClick={() => setPainLevel(option.value)}
            >
              <span className="option-icon">
                <PainLevelIcon level={option.value} selected={painLevel === option.value} />
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
                className={`circle-option pressable ${selected ? 'selected lavender' : ''}`}
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
          <FaceSmile className="h-5 w-5" />
          <span>心情记录</span>
          <small>{mood || emptyMoodLabel}</small>
        </div>
        <div className="icon-grid icon-grid-5 mood-grid">
          {moodOptions.map((item, index) => {
            const Icon = moodOptionIcons[index] || FaceSmile;
            return (
              <button
                type="button"
                key={item}
                className={`circle-option pressable ${mood === item ? 'selected green' : ''}`}
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
          ref={notesTextareaRef}
          maxLength={200}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="写下你的感受..."
        />
        <small>{notes.length}/200</small>
      </label>

      <AlertDialog open={deletePeriodDialogOpen} onOpenChange={setDeletePeriodDialogOpen}>
        <AlertDialogContent className="record-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>取消这段经期记录？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除从 {visibleCycle ? formatDateCN(new Date(`${visibleCycle.startDate}T12:00:00`)) : '这一天'} 开始的经期记录。
              当天的流量、疼痛、症状、心情和备注会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="record-confirm-actions">
            <AlertDialogCancel>保留</AlertDialogCancel>
            <AlertDialogAction
              className="record-danger-action"
              disabled={deletingPeriod}
              onClick={(event) => {
                event.preventDefault();
                handleDeletePeriod();
              }}
            >
              {deletingPeriod ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent className="record-confirm-dialog record-unsaved-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>内容还没有保存</AlertDialogTitle>
            <AlertDialogDescription>
              你已经填写或选择了记录内容，直接返回会丢失这些更改。是否先保存？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="record-confirm-actions record-unsaved-actions">
            <AlertDialogCancel onClick={onKeepEditing}>继续编辑</AlertDialogCancel>
            <AlertDialogAction className="record-discard-action" onClick={onBack}>
              不保存
            </AlertDialogAction>
            <AlertDialogAction
              className="record-save-action"
              disabled={savingFromPrompt}
              onClick={(event) => {
                event.preventDefault();
                handleSaveFromPrompt();
              }}
            >
              {savingFromPrompt ? '保存中...' : '保存'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function FlowIntensityIcon({ intensity, selected }: { intensity: FlowIntensity; selected: boolean }) {
  const Icon =
    intensity === 'very_light'
      ? Drop
      : intensity === 'light'
        ? Droplet
        : intensity === 'medium'
          ? FlowMediumIcon
          : intensity === 'heavy'
            ? Drops
            : FlowVeryHeavyIcon;

  return <Icon className={`flow-intensity-icon flow-${intensity}`} />;
}

function PainLevelIcon({ level, selected }: { level: PainLevel; selected: boolean }) {
  const commonProps = {
    className: `pain-level-icon pain-${level}`,
  };

  if (level === 'none') {
    return <Ban {...commonProps} />;
  }

  if (level === 'mild') {
    return <Bolt {...commonProps} />;
  }

  if (level === 'moderate') {
    return <PainModerateIcon {...commonProps} />;
  }

  return <PainSevereIcon {...commonProps} />;
}

function getPeriodMarkerForDate(cycle: CycleData | undefined, date: string): PeriodMarker {
  if (!cycle) return null;
  if (cycle.endDate === date) return 'end';
  return 'start';
}

function getRecordPhaseLabel(
  date: string,
  cycle: CycleData | null,
  cycles: CycleData[],
  settings?: Settings | null,
  cycleModel?: CycleModel | null
) {
  if (cycle) {
    const day = Math.floor((parseLocalDate(date).getTime() - parseLocalDate(cycle.startDate).getTime()) / 86400000) + 1;
    return `经期·第${Math.max(1, day)}天`;
  }

  if (!settings?.lastPeriodStart || !cycleModel) return '周期待完善';

  const phaseInfo = getCyclePhaseInfoForDate(parseLocalDate(date), {
    cycles,
    lastPeriodStart: settings.lastPeriodStart,
    cycleLength: cycleModel.effectiveCycleLength,
    periodLength: cycleModel.effectivePeriodLength,
    predictedPeriodDateSet: cycleModel.predictedPeriodDateSet,
  });

  if (!phaseInfo) return '周期待完善';

  const phaseName = phaseInfo.phase === 'menstrual' && !phaseInfo.isRecordedPeriod ? '预计经期' : getPhaseShortName(phaseInfo.phase);

  return `${phaseName}·第${phaseInfo.phaseDay}天`;
}

function getPhaseShortName(phase: CyclePhase) {
  if (phase === 'menstrual') return '经期';
  if (phase === 'follicular') return '卵泡期';
  if (phase === 'ovulation') return '排卵期';
  return '黄体期';
}
