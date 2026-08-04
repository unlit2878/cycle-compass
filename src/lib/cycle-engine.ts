import { CycleData, DailyLog, Settings } from './db';
import {
  buildPeriodDateSet,
  FertilityWindowInfo,
  formatDate,
  getFertilityWindowForNextPeriodStart,
  getCyclePhaseInfoForDate,
  parseLocalDate,
  PhaseInfo,
} from './cycle-utils';
import {
  calculateStdDev,
  evaluatePredictionAccuracy,
  extractCycleLengths,
  predictNextCycle,
  PredictionResult,
} from './prediction-utils';

export type MetricSource = 'history' | 'settings';
export type MetricConfidence = 'low' | 'medium' | 'high';

export interface DateRangeModel {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
}

export interface LengthMetric {
  value: number;
  source: MetricSource;
  sampleSize: number;
  ignoredCount: number;
  outlierCount: number;
  confidence: MetricConfidence;
}

export interface RegularityMetric {
  score: number | null;
  mean: number;
  min: number;
  max: number;
  variation: number;
  stdDev: number;
  cv: number;
  sampleSize: number;
  confidence: MetricConfidence;
  lengths: number[];
}

export interface CycleAnalytics {
  averageCycleLength: number;
  averagePeriodLength: number;
  totalCyclesTracked: number;
  totalDaysLogged: number;
  cycleLength: LengthMetric;
  periodLength: LengthMetric;
  cycleLengthRange: { min: number; max: number } | null;
  periodLengthRange: { min: number; max: number; avg: number } | null;
  regularity: RegularityMetric | null;
  predictionAccuracy: ReturnType<typeof evaluatePredictionAccuracy>;
}

export interface CycleModel {
  effectiveCycleLength: number;
  effectivePeriodLength: number;
  cycleLength: LengthMetric;
  periodLength: LengthMetric;
  prediction: PredictionResult;
  lastPeriodStartDate: Date | null;
  lastPeriodStartDateStr: string | null;
  currentPhase: PhaseInfo | null;
  nextPeriodRange: DateRangeModel | null;
  nextPeriodStartWindow: DateRangeModel | null;
  nextFertilityWindow: FertilityWindowInfo | null;
  periodDateSet: Set<string>;
  predictedPeriodDateSet: Set<string>;
  analytics: CycleAnalytics;
}

const MIN_PERIOD_LENGTH = 1;
const MAX_PERIOD_LENGTH = 14;

function confidenceForSamples(sampleSize: number): MetricConfidence {
  if (sampleSize >= 4) return 'high';
  if (sampleSize >= 2) return 'medium';
  return 'low';
}

function getSortedCycles(cycles: CycleData[]): CycleData[] {
  return [...cycles].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  );
}

function getLatestPeriodStart(settings: Settings, cycles: CycleData[]): string | undefined {
  const sorted = getSortedCycles(cycles);
  return sorted[sorted.length - 1]?.startDate || settings.lastPeriodStart;
}

function getPeriodLengths(cycles: CycleData[]): { valid: number[]; ignoredCount: number } {
  let ignoredCount = 0;
  const valid: number[] = [];

  cycles.forEach((cycle) => {
    if (!cycle.startDate || !cycle.endDate) return;

    const start = parseLocalDate(cycle.startDate);
    const end = parseLocalDate(cycle.endDate);
    const length = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (length >= MIN_PERIOD_LENGTH && length <= MAX_PERIOD_LENGTH) {
      valid.push(length);
    } else {
      ignoredCount += 1;
    }
  });

  return { valid, ignoredCount };
}

function getCycleLengthMetric(settings: Settings, cycles: CycleData[]): {
  metric: LengthMetric;
  lengths: number[];
  prediction: PredictionResult;
} {
  const extracted = extractCycleLengths(cycles);
  const lengths = extracted.map((item) => item.length);
  const sorted = getSortedCycles(cycles);
  const possibleIntervals = Math.max(0, sorted.length - 1);
  const ignoredCount = Math.max(0, possibleIntervals - lengths.length);
  const prediction = predictNextCycle(cycles);

  if (lengths.length === 0) {
    return {
      lengths,
      prediction,
      metric: {
        value: settings.averageCycleLength,
        source: 'settings',
        sampleSize: 0,
        ignoredCount,
        outlierCount: prediction.outlierCount,
        confidence: 'low',
      },
    };
  }

  return {
    lengths,
    prediction,
    metric: {
      value: prediction.predictedCycleLength,
      source: 'history',
      sampleSize: lengths.length,
      ignoredCount,
      outlierCount: prediction.outlierCount,
      confidence: confidenceForSamples(lengths.length),
    },
  };
}

function getPeriodLengthMetric(settings: Settings, cycles: CycleData[]): {
  metric: LengthMetric;
  lengths: number[];
} {
  const { valid, ignoredCount } = getPeriodLengths(cycles);
  const hasHistory = valid.length > 0;
  const value = hasHistory
    ? Math.round(valid.reduce((sum, length) => sum + length, 0) / valid.length)
    : settings.averagePeriodLength;

  return {
    lengths: valid,
    metric: {
      value,
      source: hasHistory ? 'history' : 'settings',
      sampleSize: valid.length,
      ignoredCount,
      outlierCount: 0,
      confidence: valid.length > 0 ? confidenceForSamples(valid.length) : 'low',
    },
  };
}

function getRegularityMetric(lengths: number[]): RegularityMetric | null {
  if (lengths.length === 0) return null;

  const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const variation = max - min;
  const stdDev = calculateStdDev(lengths);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

  let score: number | null = null;
  if (lengths.length >= 2) {
    if (cv < 5) {
      score = 90 + (5 - cv) * 2;
    } else if (cv < 10) {
      score = 75 + (10 - cv) * 3;
    } else if (cv < 15) {
      score = 60 + (15 - cv) * 3;
    } else if (cv < 20) {
      score = 40 + (20 - cv) * 4;
    } else {
      score = Math.max(0, 40 - (cv - 20) * 2);
    }
    score = Math.min(100, Math.round(score));
  }

  return {
    score,
    mean,
    min,
    max,
    variation,
    stdDev,
    cv,
    sampleSize: lengths.length,
    confidence: confidenceForSamples(lengths.length),
    lengths,
  };
}

function getNextPeriodRange(
  lastPeriodStart: string | undefined,
  cycleLength: number,
  periodLength: number,
  today: Date
): DateRangeModel | null {
  if (!lastPeriodStart) return null;

  const todayAtNoon = new Date(today);
  todayAtNoon.setHours(12, 0, 0, 0);

  const startDate = parseLocalDate(lastPeriodStart);
  while (startDate <= todayAtNoon) {
    startDate.setDate(startDate.getDate() + cycleLength);
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + periodLength - 1);

  return {
    startDate,
    endDate,
    startDateStr: formatDate(startDate),
    endDateStr: formatDate(endDate),
  };
}

function getNextPeriodStartWindow(
  lastPeriodStart: string | undefined,
  prediction: PredictionResult,
  today: Date
): DateRangeModel | null {
  if (!lastPeriodStart) return null;

  const todayAtNoon = new Date(today);
  todayAtNoon.setHours(12, 0, 0, 0);

  const startDate = parseLocalDate(lastPeriodStart);
  const lowerDate = new Date(startDate);
  const upperDate = new Date(startDate);
  lowerDate.setDate(lowerDate.getDate() + prediction.lowerBound);
  upperDate.setDate(upperDate.getDate() + prediction.upperBound);

  while (upperDate <= todayAtNoon) {
    lowerDate.setDate(lowerDate.getDate() + prediction.predictedCycleLength);
    upperDate.setDate(upperDate.getDate() + prediction.predictedCycleLength);
  }

  return {
    startDate: lowerDate,
    endDate: upperDate,
    startDateStr: formatDate(lowerDate),
    endDateStr: formatDate(upperDate),
  };
}

function buildPredictedPeriodDateSet(
  lastPeriodStart: string | undefined,
  cycleLength: number,
  periodLength: number,
  today: Date,
  count: number = 12
): Set<string> {
  const dates = new Set<string>();
  if (!lastPeriodStart) return dates;

  const todayAtNoon = new Date(today);
  todayAtNoon.setHours(12, 0, 0, 0);

  const startDate = parseLocalDate(lastPeriodStart);
  while (startDate <= todayAtNoon) {
    startDate.setDate(startDate.getDate() + cycleLength);
  }

  for (let i = 0; i < count; i++) {
    const periodStart = new Date(startDate);
    periodStart.setDate(periodStart.getDate() + cycleLength * i);

    for (let day = 0; day < periodLength; day++) {
      const date = new Date(periodStart);
      date.setDate(date.getDate() + day);
      dates.add(formatDate(date));
    }
  }

  return dates;
}

export function createCycleModel(
  settings: Settings,
  cycles: CycleData[],
  dailyLogs: DailyLog[],
  today: Date = new Date()
): CycleModel {
  const cycleLengthResult = getCycleLengthMetric(settings, cycles);
  const periodLengthResult = getPeriodLengthMetric(settings, cycles);
  const effectiveCycleLength = cycleLengthResult.metric.value;
  const effectivePeriodLength = periodLengthResult.metric.value;
  const lastPeriodStart = getLatestPeriodStart(settings, cycles);
  const lastPeriodStartDate = lastPeriodStart ? parseLocalDate(lastPeriodStart) : null;

  const currentDate = new Date(today);
  currentDate.setHours(12, 0, 0, 0);

  const currentPhase = getCyclePhaseInfoForDate(currentDate, {
    cycles,
    lastPeriodStart,
    cycleLength: effectiveCycleLength,
    periodLength: effectivePeriodLength,
  });

  const nextPeriodRange = getNextPeriodRange(
    lastPeriodStart,
    effectiveCycleLength,
    effectivePeriodLength,
    currentDate
  );
  const nextPeriodStartWindow = getNextPeriodStartWindow(
    lastPeriodStart,
    cycleLengthResult.prediction,
    currentDate
  );
  const nextFertilityWindow = nextPeriodRange
    ? getFertilityWindowForNextPeriodStart(nextPeriodRange.startDate, effectiveCycleLength)
    : null;

  const periodDateSet = buildPeriodDateSet(cycles);
  const predictedPeriodDateSet = buildPredictedPeriodDateSet(
    lastPeriodStart,
    effectiveCycleLength,
    effectivePeriodLength,
    currentDate
  );

  const periodLengths = periodLengthResult.lengths;
  const cycleLengths = cycleLengthResult.lengths;
  const regularity = getRegularityMetric(cycleLengths);
  const predictionAccuracy = evaluatePredictionAccuracy(cycles);

  return {
    effectiveCycleLength,
    effectivePeriodLength,
    cycleLength: cycleLengthResult.metric,
    periodLength: periodLengthResult.metric,
    prediction: cycleLengthResult.prediction,
    lastPeriodStartDate,
    lastPeriodStartDateStr: lastPeriodStart || null,
    currentPhase,
    nextPeriodRange,
    nextPeriodStartWindow,
    nextFertilityWindow,
    periodDateSet,
    predictedPeriodDateSet,
    analytics: {
      averageCycleLength: effectiveCycleLength,
      averagePeriodLength: effectivePeriodLength,
      totalCyclesTracked: cycles.length,
      totalDaysLogged: dailyLogs.length,
      cycleLength: cycleLengthResult.metric,
      periodLength: periodLengthResult.metric,
      cycleLengthRange:
        cycleLengths.length > 0
          ? { min: Math.min(...cycleLengths), max: Math.max(...cycleLengths) }
          : null,
      periodLengthRange:
        periodLengths.length > 0
          ? {
              min: Math.min(...periodLengths),
              max: Math.max(...periodLengths),
              avg: Math.round(periodLengths.reduce((sum, length) => sum + length, 0) / periodLengths.length),
            }
          : null,
      regularity,
      predictionAccuracy,
    },
  };
}
