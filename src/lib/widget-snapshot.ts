import type { CycleData } from './db';
import type { CycleModel } from './cycle-engine';
import type { CyclePhase } from './cycle-utils';
import { parseLocalDate } from './cycle-utils';

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
 * The deliberately small, non-sensitive payload persisted by the Android
 * widget. Daily logs, symptoms and notes must never cross this boundary.
 *
 * Cycle rows carry lengths only — never the dates they were derived from —
 * so the snapshot cannot be used to reconstruct when a period occurred.
 */
export interface WidgetSnapshot {
  schemaVersion: 2;
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
}

function daysBetween(startDateStr: string, endDateStr: string): number {
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
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
    schemaVersion: 2,
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
  };
}
