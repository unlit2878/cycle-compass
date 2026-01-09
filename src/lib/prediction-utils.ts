import { CycleData } from './db';
import { parseISO, differenceInDays } from 'date-fns';

/**
 * 周期预测统计工具
 * 使用多种统计学方法来提高周期预测的准确性
 */

export interface PredictionResult {
  predictedCycleLength: number;
  confidence: number;
  method: 'ewma' | 'sma' | 'weighted';
  lowerBound: number;
  upperBound: number;
}

export interface CycleLengthData {
  date: string;
  length: number;
}

/**
 * 从周期数据中提取周期长度
 */
export function extractCycleLengths(cycles: CycleData[]): CycleLengthData[] {
  const sortedCycles = [...cycles].sort((a, b) => 
    parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  );
  
  const lengths: CycleLengthData[] = [];
  
  for (let i = 0; i < sortedCycles.length - 1; i++) {
    const currentStart = parseISO(sortedCycles[i].startDate);
    const nextStart = parseISO(sortedCycles[i + 1].startDate);
    const length = differenceInDays(nextStart, currentStart);
    
    // 过滤掉异常值（周期长度应该在合理范围内）
    if (length >= 18 && length <= 45) {
      lengths.push({
        date: sortedCycles[i].startDate,
        length,
      });
    }
  }
  
  return lengths;
}

/**
 * 简单移动平均（SMA）
 * 适用于周期相对稳定的用户
 */
export function calculateSMA(lengths: number[], window: number = 3): number {
  if (lengths.length === 0) return 28;
  if (lengths.length < window) {
    return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
  }
  
  const recentLengths = lengths.slice(-window);
  return Math.round(recentLengths.reduce((a, b) => a + b, 0) / window);
}

/**
 * 指数加权移动平均（EWMA）
 * 更重视近期数据，适用于周期可能有变化趋势的用户
 * 
 * @param lengths - 周期长度数组（按时间顺序）
 * @param alpha - 平滑因子 (0-1)，值越大对近期数据权重越高
 */
export function calculateEWMA(lengths: number[], alpha: number = 0.3): number {
  if (lengths.length === 0) return 28;
  if (lengths.length === 1) return lengths[0];
  
  let ewma = lengths[0];
  
  for (let i = 1; i < lengths.length; i++) {
    ewma = alpha * lengths[i] + (1 - alpha) * ewma;
  }
  
  return Math.round(ewma);
}

/**
 * 加权移动平均
 * 给最近的周期更高的权重
 */
export function calculateWeightedMA(lengths: number[]): number {
  if (lengths.length === 0) return 28;
  if (lengths.length === 1) return lengths[0];
  
  // 使用最近的6个周期
  const recentLengths = lengths.slice(-6);
  const n = recentLengths.length;
  
  // 权重：最近的权重最高
  // 例如 n=4: 权重为 1, 2, 3, 4
  let weightSum = 0;
  let weightedSum = 0;
  
  for (let i = 0; i < n; i++) {
    const weight = i + 1;
    weightedSum += recentLengths[i] * weight;
    weightSum += weight;
  }
  
  return Math.round(weightedSum / weightSum);
}

/**
 * 计算标准差
 */
export function calculateStdDev(lengths: number[]): number {
  if (lengths.length < 2) return 0;
  
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const squareDiffs = lengths.map(len => Math.pow(len - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / lengths.length;
  
  return Math.sqrt(avgSquareDiff);
}

/**
 * 计算置信区间
 * 使用正态分布的95%置信区间
 */
export function calculateConfidenceInterval(
  mean: number,
  stdDev: number,
  n: number
): { lower: number; upper: number } {
  // 95%置信区间使用1.96作为z值
  const marginOfError = 1.96 * (stdDev / Math.sqrt(n));
  
  return {
    lower: Math.round(Math.max(18, mean - marginOfError)),
    upper: Math.round(Math.min(45, mean + marginOfError)),
  };
}

/**
 * 综合预测
 * 根据数据特征选择最佳预测方法
 */
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
    };
  }
  
  const stdDev = calculateStdDev(lengths);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  
  // 根据标准差选择方法
  // 标准差小 -> 周期规律，用SMA
  // 标准差大 -> 周期不规律，用EWMA（更重视近期）
  let predictedLength: number;
  let method: 'ewma' | 'sma' | 'weighted';
  
  if (stdDev <= 2) {
    // 非常规律，使用SMA
    predictedLength = calculateSMA(lengths, 3);
    method = 'sma';
  } else if (stdDev <= 4) {
    // 较规律，使用加权移动平均
    predictedLength = calculateWeightedMA(lengths);
    method = 'weighted';
  } else {
    // 不太规律，使用EWMA，更重视近期数据
    predictedLength = calculateEWMA(lengths, 0.4);
    method = 'ewma';
  }
  
  // 计算置信区间
  const { lower, upper } = calculateConfidenceInterval(mean, stdDev, lengths.length);
  
  // 计算置信度（基于标准差和样本量）
  const baseConfidence = Math.max(0.3, 1 - stdDev / 10);
  const sampleBonus = Math.min(0.2, lengths.length * 0.02);
  const confidence = Math.min(0.95, baseConfidence + sampleBonus);
  
  return {
    predictedCycleLength: predictedLength,
    confidence,
    method,
    lowerBound: lower,
    upperBound: upper,
  };
}

/**
 * 使用改进的预测方法评估历史预测准确性
 */
export function evaluatePredictionAccuracy(cycles: CycleData[]): {
  predictions: Array<{
    cycleDate: string;
    predicted: number;
    actual: number;
    error: number;
    method: string;
  }>;
  avgError: number;
  accuracyRate: number;
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
  }> = [];
  
  // 从第3个周期开始，使用前面的数据进行预测
  for (let i = 2; i < sortedCycles.length; i++) {
    const historicalCycles = sortedCycles.slice(0, i);
    const prediction = predictNextCycle(historicalCycles);
    
    const currentStart = parseISO(sortedCycles[i - 1].startDate);
    const nextStart = parseISO(sortedCycles[i].startDate);
    const actualLength = differenceInDays(nextStart, currentStart);
    
    if (actualLength >= 18 && actualLength <= 45) {
      predictions.push({
        cycleDate: sortedCycles[i].startDate,
        predicted: prediction.predictedCycleLength,
        actual: actualLength,
        error: actualLength - prediction.predictedCycleLength,
        method: prediction.method,
      });
    }
  }
  
  if (predictions.length === 0) {
    return { predictions: [], avgError: 0, accuracyRate: 0 };
  }
  
  const avgError = predictions.reduce((sum, p) => sum + Math.abs(p.error), 0) / predictions.length;
  const accurateCount = predictions.filter(p => Math.abs(p.error) <= 2).length;
  const accuracyRate = Math.round((accurateCount / predictions.length) * 100);
  
  return { predictions, avgError, accuracyRate };
}

/**
 * 获取预测方法的中文名称
 */
export function getMethodName(method: 'ewma' | 'sma' | 'weighted'): string {
  switch (method) {
    case 'sma':
      return '简单移动平均';
    case 'ewma':
      return '指数加权平均';
    case 'weighted':
      return '加权移动平均';
    default:
      return '统计预测';
  }
}
