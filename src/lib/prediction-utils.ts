import { CycleData } from './db';
import { parseISO, differenceInDays } from 'date-fns';

export type PredictionMethod = 'ewma' | 'sma' | 'weighted' | 'robust';

export interface PredictionResult {
  predictedCycleLength: number;
  confidence: number;
  method: PredictionMethod;
  lowerBound: number;
  upperBound: number;
  sampleSize: number;
  outlierCount: number;
  windowRadius: number;
}

export interface CycleLengthData {
  date: string;
  length: number;
  weight: number;
  isOutlier: boolean;
}

const MIN_REASONABLE_CYCLE = 18;
const MAX_TYPICAL_CYCLE = 45;
const MAX_EXTENDED_CYCLE = 60;
const LONG_CYCLE_WEIGHT = 0.35;

export function extractCycleLengths(cycles: CycleData[]): CycleLengthData[] {
  const sortedCycles = [...cycles].sort((a, b) =>
    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  );

  const lengths: CycleLengthData[] = [];

  for (let i = 0; i < sortedCycles.length - 1; i++) {
    const currentStart = parseISO(sortedCycles[i].startDate);
    const nextStart = parseISO(sortedCycles[i + 1].startDate);
    const length = differenceInDays(nextStart, currentStart);

    if (length >= MIN_REASONABLE_CYCLE && length <= MAX_EXTENDED_CYCLE) {
      const isOutlier = length > MAX_TYPICAL_CYCLE;
      lengths.push({
        date: sortedCycles[i].startDate,
        length,
        weight: isOutlier ? LONG_CYCLE_WEIGHT : 1,
        isOutlier,
      });
    }
  }

  return lengths;
}

export function calculateSMA(lengths: number[], window: number = 3): number {
  if (lengths.length === 0) return 28;
  if (lengths.length < window) {
    return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  }

  const recentLengths = lengths.slice(-window);
  return Math.round(recentLengths.reduce((a, b) => a + b, 0) / window);
}

export function calculateEWMA(lengths: number[], alpha: number = 0.3): number {
  if (lengths.length === 0) return 28;
  if (lengths.length === 1) return lengths[0];

  let ewma = lengths[0];

  for (let i = 1; i < lengths.length; i++) {
    ewma = alpha * lengths[i] + (1 - alpha) * ewma;
  }

  return Math.round(ewma);
}

export function calculateWeightedMA(lengths: number[]): number {
  if (lengths.length === 0) return 28;
  if (lengths.length === 1) return lengths[0];

  const recentLengths = lengths.slice(-6);
  const n = recentLengths.length;

  let weightSum = 0;
  let weightedSum = 0;

  for (let i = 0; i < n; i++) {
    const weight = i + 1;
    weightedSum += recentLengths[i] * weight;
    weightSum += weight;
  }

  return Math.round(weightedSum / weightSum);
}

export function calculateStdDev(lengths: number[]): number {
  if (lengths.length < 2) return 0;

  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const squareDiffs = lengths.map(len => Math.pow(len - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / lengths.length;

  return Math.sqrt(avgSquareDiff);
}

export function calculateConfidenceInterval(
  mean: number,
  stdDev: number,
  n: number
): { lower: number; upper: number } {
  const marginOfError = 1.96 * (stdDev / Math.sqrt(n));

  return {
    lower: Math.round(Math.max(MIN_REASONABLE_CYCLE, mean - marginOfError)),
    upper: Math.round(Math.min(MAX_EXTENDED_CYCLE, mean + marginOfError)),
  };
}

function calculateMean(lengths: number[]): number {
  if (lengths.length === 0) return 28;
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

function calculateWeightedMean(data: Array<{ length: number; weight: number }>): number {
  if (data.length === 0) return 28;

  const totals = data.reduce(
    (acc, item) => ({
      weightedSum: acc.weightedSum + item.length * item.weight,
      weightSum: acc.weightSum + item.weight,
    }),
    { weightedSum: 0, weightSum: 0 }
  );

  return totals.weightedSum / totals.weightSum;
}

function calculateWeightedRecentMean(data: CycleLengthData[], window: number = 6): number {
  const recent = data.slice(-window);
  if (recent.length === 0) return 28;

  return calculateWeightedMean(
    recent.map((item, index) => ({
      length: item.length,
      weight: item.weight * (index + 1),
    }))
  );
}

function calculateMedian(lengths: number[]): number {
  if (lengths.length === 0) return 28;
  const sorted = [...lengths].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function calculateQuantile(lengths: number[], quantile: number): number {
  if (lengths.length === 0) return 28;
  const sorted = [...lengths].sort((a, b) => a - b);
  const index = (sorted.length - 1) * quantile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function predictNextCycle(cycles: CycleData[]): PredictionResult {
  const cycleLengthData = extractCycleLengths(cycles);
  const lengths = cycleLengthData.map(d => d.length);

  if (lengths.length === 0) {
    return {
      predictedCycleLength: 28,
      confidence: 0.5,
      method: 'sma',
      lowerBound: 25,
      upperBound: 31,
      sampleSize: 0,
      outlierCount: 0,
      windowRadius: 3,
    };
  }

  const normalLengths = cycleLengthData.filter(d => !d.isOutlier).map(d => d.length);
  const outlierCount = cycleLengthData.filter(d => d.isOutlier).length;
  const stdDev = calculateStdDev(lengths);
  const mean = calculateMean(lengths);

  let predictedLength: number;
  let method: PredictionMethod;

  if (stdDev <= 2) {
    predictedLength = calculateSMA(lengths, 3);
    method = 'sma';
  } else {
    const stableCenter = calculateMedian(normalLengths.length > 0 ? normalLengths : lengths);
    const weightedAverage = calculateWeightedMean(cycleLengthData);
    const recentAverage = calculateWeightedRecentMean(cycleLengthData, 6);
    predictedLength = Math.round(stableCenter * 0.5 + weightedAverage * 0.3 + recentAverage * 0.2);
    method = 'robust';
  }

  const windowSource = normalLengths.length >= 4 ? normalLengths : lengths;
  const q20 = calculateQuantile(windowSource, 0.2);
  const q80 = calculateQuantile(windowSource, 0.8);
  const windowRadius = Math.max(
    3,
    Math.round(stdDev),
    Math.ceil(Math.max(predictedLength - q20, q80 - predictedLength))
  );
  const lower = Math.max(MIN_REASONABLE_CYCLE, predictedLength - windowRadius);
  const upper = Math.min(MAX_EXTENDED_CYCLE, predictedLength + windowRadius);

  const baseConfidence = Math.max(0.25, 1 - stdDev / 10);
  const sampleBonus = Math.min(0.2, lengths.length * 0.02);
  const outlierPenalty = Math.min(0.12, outlierCount * 0.04);
  const confidence = Math.min(0.9, Math.max(0.25, baseConfidence + sampleBonus - outlierPenalty));

  return {
    predictedCycleLength: predictedLength,
    confidence,
    method,
    lowerBound: lower,
    upperBound: upper,
    sampleSize: lengths.length,
    outlierCount,
    windowRadius,
  };
}

export function evaluatePredictionAccuracy(cycles: CycleData[]): {
  predictions: Array<{
    cycleDate: string;
    predicted: number;
    actual: number;
    error: number;
    method: string;
    wasOutlier: boolean;
  }>;
  avgError: number;
  accuracyRate: number;
  windowHitRate: number;
} {
  const sortedCycles = [...cycles].sort((a, b) =>
    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  );

  const predictions: Array<{
    cycleDate: string;
    predicted: number;
    actual: number;
    error: number;
    method: string;
    wasOutlier: boolean;
  }> = [];

  for (let i = 2; i < sortedCycles.length; i++) {
    const historicalCycles = sortedCycles.slice(0, i);
    const prediction = predictNextCycle(historicalCycles);

    const currentStart = parseISO(sortedCycles[i - 1].startDate);
    const nextStart = parseISO(sortedCycles[i].startDate);
    const actualLength = differenceInDays(nextStart, currentStart);

    if (actualLength >= MIN_REASONABLE_CYCLE && actualLength <= MAX_EXTENDED_CYCLE) {
      predictions.push({
        cycleDate: sortedCycles[i].startDate,
        predicted: prediction.predictedCycleLength,
        actual: actualLength,
        error: actualLength - prediction.predictedCycleLength,
        method: prediction.method,
        wasOutlier: actualLength > MAX_TYPICAL_CYCLE,
      });
    }
  }

  if (predictions.length === 0) {
    return { predictions: [], avgError: 0, accuracyRate: 0, windowHitRate: 0 };
  }

  const avgError = predictions.reduce((sum, p) => sum + Math.abs(p.error), 0) / predictions.length;
  const accurateCount = predictions.filter(p => Math.abs(p.error) <= 2).length;
  const windowHitCount = predictions.filter(p => Math.abs(p.error) <= 5).length;
  const accuracyRate = Math.round((accurateCount / predictions.length) * 100);
  const windowHitRate = Math.round((windowHitCount / predictions.length) * 100);

  return { predictions, avgError, accuracyRate, windowHitRate };
}

export function getMethodName(method: PredictionMethod): string {
  switch (method) {
    case 'sma':
      return '简单移动平均';
    case 'ewma':
      return '指数加权平均';
    case 'weighted':
      return '加权移动平均';
    case 'robust':
      return '稳健窗口预测';
    default:
      return '统计预测';
  }
}
