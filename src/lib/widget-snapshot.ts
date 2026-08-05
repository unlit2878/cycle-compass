import type { CycleData } from './db';
import type { CycleModel } from './cycle-engine';
import type { CyclePhase } from './cycle-utils';
import {
  atNoon,
  formatDate,
  getCyclePhaseInfoForDate,
  getMostRecentExpectedStart,
  parseLocalDate,
} from './cycle-utils';

/** Widget rows show at most the last two completed cycles. */
const MAX_ROWS = 2;
/**
 * Matches prediction-utils' MIN_REASONABLE_CYCLE/MAX_EXTENDED_CYCLE, which is
 * what the trends page keeps. The engine's stricter 45-day guard only marks a
 * cycle as an outlier for prediction weighting — it does not discard it, so
 * reusing it here would silently hide long cycles the app happily charts.
 */
const MIN_CYCLE_LENGTH = 18;
const MAX_CYCLE_LENGTH = 60;
const MIN_PERIOD_LENGTH = 1;
const MAX_PERIOD_LENGTH = 14;
/** Mirrors the floor in InsightsPage.getChartScale. */
const BAR_SCALE_FLOOR = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One completed cycle, as the widget draws it: a single bar track where the
 * period segment overlaps the start of the cycle segment.
 */
export interface WidgetCycleRow {
  /** Days between this period's start and the next one. */
  cycleLength: number;
  /** Days from this period's start to its end, inclusive. */
  periodLength: number;
}

/**
 * What the widget's hero line shows on a given day, mirroring Home's three
 * hero branches: a recorded/ongoing period day, a countdown to the next
 * predicted start, or an overdue prediction ("late").
 */
export type WidgetDayState = 'period' | 'countdown' | 'late';

/** One precomputed day of widget copy. */
export interface WidgetDayEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  state: WidgetDayState;
  /** Phase driving the badge and ring colours on this day. */
  phase: CyclePhase;
  /**
   * period: day within the period (1-based). countdown: days until the next
   * predicted start (>= 1). late: days past the predicted start (0 = the
   * predicted day itself).
   */
  number: number;
}

/**
 * How far ahead the day table reaches. The app rewrites the whole table on
 * every sync, so this is only the offline buffer for a phone whose owner does
 * not open the app at all; past it the widget falls back to the frozen
 * snapshot fields, which is the pre-table behaviour.
 */
const DAY_TABLE_LENGTH = 90;

/**
 * The deliberately small, non-sensitive payload persisted by the Android
 * widget. Daily logs, symptoms and notes must never cross this boundary.
 *
 * Cycle rows carry lengths only — never the dates they were derived from —
 * so the snapshot cannot be used to reconstruct when a period occurred.
 */
export interface WidgetSnapshot {
  schemaVersion: 3;
  hasData: boolean;
  updatedAt: string;
  phase?: CyclePhase;
  phaseDay?: number;
  daysUntilNextPeriod?: number;
  nextPeriodStart?: string;
  /** Oldest first, so the last entry is always the most recent cycle. */
  recentCycles?: WidgetCycleRow[];
  /** Mean cycle length across all usable history, for the average marker. */
  averageCycleLength?: number;
  /**
   * Upper bound of the bar axis, mirroring InsightsPage.getChartScale so a
   * long cycle is never drawn clipped at full width.
   */
  barScale?: number;
  /**
   * Today plus the next {@link DAY_TABLE_LENGTH} days, precomputed so the
   * widget's midnight refresh can show the right numbers without the app
   * running. Each entry equals what the app itself would compute live on that
   * date, because predictions depend only on recorded data — and recording
   * anything rewrites this table.
   */
  dayTable?: WidgetDayEntry[];
}

function daysBetween(startDateStr: string, endDateStr: string): number {
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

/**
 * Precomputes one hero line per day, so the widget's own midnight refresh can
 * show the right numbers without the app process ever running.
 *
 * Each entry mirrors what the app would say live on that date, in Home's
 * branch order: a menstrual-phase day (recorded, or the continuation of a
 * period that has a start but no end yet) shows the period day count; then an
 * overdue prediction shows lateness; otherwise the countdown to the next
 * predicted start. Predictions depend only on recorded data, so these rows
 * cannot drift from a live computation — any recording rewrites the table.
 *
 * The phase is computed exactly like CycleModel.currentPhase (in particular,
 * without predictedPeriodDateSet): an unrecorded predicted period day must
 * not claim the period started, so it reads as late + luteal, not menstrual.
 */
export function buildDayTable(
  cycleModel: CycleModel,
  cycles: CycleData[],
  today: Date
): WidgetDayEntry[] {
  const lastPeriodStart = cycleModel.lastPeriodStartDateStr;
  if (!lastPeriodStart) return [];

  const cycleLength = Math.max(1, Math.round(cycleModel.effectiveCycleLength));
  const periodLength = Math.max(1, Math.round(cycleModel.effectivePeriodLength));
  const entries: WidgetDayEntry[] = [];

  for (let offset = 0; offset < DAY_TABLE_LENGTH; offset += 1) {
    const date = atNoon(today);
    date.setDate(date.getDate() + offset);

    const phaseInfo = getCyclePhaseInfoForDate(date, {
      cycles,
      lastPeriodStart,
      cycleLength,
      periodLength,
    });
    if (!phaseInfo) continue;

    const dateStr = formatDate(date);
    // Home enters its period hero only for a date the user actually marked.
    // In particular, an open record marks its start day only; later days must
    // not silently become recorded period days in the widget.
    if (phaseInfo.isRecordedPeriod) {
      entries.push({
        date: dateStr,
        state: 'period',
        phase: 'menstrual',
        number: Math.max(1, phaseInfo.phaseDay),
      });
      continue;
    }

    const expectedStart = getMostRecentExpectedStart(lastPeriodStart, cycleLength, date);
    if (expectedStart) {
      // Noon-to-noon, so round is exact; Home's floor agrees outside DST edges.
      const lateDays = Math.round((date.getTime() - expectedStart.getTime()) / DAY_MS);
      entries.push({
        date: dateStr,
        state: 'late',
        phase: phaseInfo.phase,
        number: Math.max(0, lateDays),
      });
      continue;
    }

    // First predicted start strictly after this date, as getNextPeriodRange walks it.
    const nextStart = parseLocalDate(lastPeriodStart);
    while (nextStart <= date) nextStart.setDate(nextStart.getDate() + cycleLength);
    entries.push({
      date: dateStr,
      state: 'countdown',
      phase: phaseInfo.phase,
      number: Math.max(1, Math.round((nextStart.getTime() - date.getTime()) / DAY_MS)),
    });
  }

  return entries;
}

/**
 * Pairs each period with the interval that follows it.
 *
 * The engine derives cycle lengths and period lengths independently, so their
 * arrays cannot be zipped: a cycle length spans two records while a period
 * length belongs to one. A widget row needs both numbers for the *same* cycle,
 * so the pairing happens here rather than by index.
 *
 * A cycle is only usable when it has a next start (to measure the interval)
 * and its own end date (to measure the period). Cycles missing either are
 * skipped, which is why the widget can need more records than it shows rows.
 */
export function buildCycleRows(cycles: CycleData[]): WidgetCycleRow[] {
  const sorted = [...cycles]
    .filter((cycle) => Boolean(cycle.startDate))
    .sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime());

  const rows: WidgetCycleRow[] = [];

  // The final record has no successor, so its cycle length is still unknown.
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const cycle = sorted[index];
    if (!cycle.endDate) continue;

    const cycleLength = daysBetween(cycle.startDate, sorted[index + 1].startDate);
    const periodLength = daysBetween(cycle.startDate, cycle.endDate) + 1;

    if (cycleLength < MIN_CYCLE_LENGTH || cycleLength > MAX_CYCLE_LENGTH) continue;
    if (periodLength < MIN_PERIOD_LENGTH || periodLength > MAX_PERIOD_LENGTH) continue;
    // A period cannot outlast the cycle that contains it.
    if (periodLength > cycleLength) continue;

    rows.push({ cycleLength, periodLength });
  }

  return rows;
}

export function buildWidgetSnapshot(
  cycleModel: CycleModel | null,
  cycles: CycleData[] = [],
  now: Date = new Date()
): WidgetSnapshot {
  const base: WidgetSnapshot = {
    schemaVersion: 3,
    hasData: false,
    updatedAt: now.toISOString(),
  };

  const phase = cycleModel?.currentPhase;
  if (!cycleModel || !phase) return base;

  const allRows = buildCycleRows(cycles);
  // The average spans every usable cycle, not just the two that are drawn.
  const averageCycleLength = allRows.length
    ? Math.round(allRows.reduce((sum, row) => sum + row.cycleLength, 0) / allRows.length)
    : undefined;
  // Same floor and inputs as the trends chart, so bars read at the same scale.
  const barScale = allRows.length
    ? Math.max(BAR_SCALE_FLOOR, ...allRows.map((row) => row.cycleLength))
    : undefined;

  return {
    ...base,
    hasData: true,
    phase: phase.phase,
    phaseDay: Math.max(1, Math.round(phase.phaseDay)),
    daysUntilNextPeriod: Math.max(0, Math.round(phase.daysUntilNextPeriod)),
    nextPeriodStart: cycleModel.nextPeriodRange?.startDateStr,
    recentCycles: allRows.slice(-MAX_ROWS),
    averageCycleLength,
    barScale,
    dayTable: buildDayTable(cycleModel, cycles, now),
  };
}
