import type { CycleData } from './db';
import { zh } from './i18n';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface PhaseInfo {
  phase: CyclePhase;
  dayInCycle: number;
  daysUntilNextPeriod: number;
  phaseDay: number;
  phaseTotalDays: number;
}

export interface CyclePhaseInfoForDate extends PhaseInfo {
  isRecordedPeriod: boolean;
  isPredictedPeriod: boolean;
  anchorStartDateStr: string;
  periodLengthUsed: number;
}

export interface PredictedPeriod {
  startDate: Date;
  endDate: Date;
  isPrediction: boolean;
}

export interface DateRangeInfo {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
}

export interface FertilityWindowInfo {
  fertileRange: DateRangeInfo;
  ovulationRange: DateRangeInfo;
}

export type CycleWindowKind = 'fertile' | 'ovulation';

const OVULATION_DAY_OFFSET_FROM_NEXT_PERIOD = 14;
const OVULATION_PHASE_RADIUS_DAYS = 2;
const FERTILE_WINDOW_START_OFFSET_FROM_OVULATION = -5;
const FERTILE_WINDOW_END_OFFSET_FROM_OVULATION = 1;
const DAY_MS = 1000 * 60 * 60 * 24;

function buildDateRange(startDate: Date, endDate: Date): DateRangeInfo {
  return {
    startDate,
    endDate,
    startDateStr: formatDate(startDate),
    endDateStr: formatDate(endDate),
  };
}

export function getOvulationDay(cycleLength: number): number {
  return Math.round(cycleLength - OVULATION_DAY_OFFSET_FROM_NEXT_PERIOD);
}

export function getCycleWindowDays(cycleLength: number): Record<CycleWindowKind, { startDay: number; endDay: number }> {
  const ovulationDay = getOvulationDay(cycleLength);
  const ovulationStartDay = ovulationDay - OVULATION_PHASE_RADIUS_DAYS;
  const ovulationEndDay = ovulationDay + OVULATION_PHASE_RADIUS_DAYS;

  return {
    ovulation: {
      startDay: ovulationStartDay,
      endDay: ovulationEndDay,
    },
    fertile: {
      startDay: ovulationDay + FERTILE_WINDOW_START_OFFSET_FROM_OVULATION,
      endDay: Math.min(ovulationDay + FERTILE_WINDOW_END_OFFSET_FROM_OVULATION, ovulationStartDay - 1),
    },
  };
}

export function getFertilityWindowForCycleStart(cycleStartDate: Date, cycleLength: number): FertilityWindowInfo {
  const windows = getCycleWindowDays(cycleLength);
  const fertileStart = new Date(cycleStartDate);
  fertileStart.setDate(fertileStart.getDate() + windows.fertile.startDay - 1);
  const fertileEnd = new Date(cycleStartDate);
  fertileEnd.setDate(fertileEnd.getDate() + windows.fertile.endDay - 1);
  const ovulationStart = new Date(cycleStartDate);
  ovulationStart.setDate(ovulationStart.getDate() + windows.ovulation.startDay - 1);
  const ovulationEnd = new Date(cycleStartDate);
  ovulationEnd.setDate(ovulationEnd.getDate() + windows.ovulation.endDay - 1);

  return {
    fertileRange: buildDateRange(fertileStart, fertileEnd),
    ovulationRange: buildDateRange(ovulationStart, ovulationEnd),
  };
}

export function getOvulationDateForCycleStart(cycleStartDate: Date, cycleLength: number): Date {
  const ovulationDate = new Date(cycleStartDate);
  ovulationDate.setDate(ovulationDate.getDate() + getOvulationDay(cycleLength) - 1);
  return ovulationDate;
}

export function getOvulationDateForNextPeriodStart(nextPeriodStart: Date, cycleLength: number): Date {
  const cycleStartDate = new Date(nextPeriodStart);
  cycleStartDate.setDate(cycleStartDate.getDate() - cycleLength);
  return getOvulationDateForCycleStart(cycleStartDate, cycleLength);
}

export function getFertilityWindowForNextPeriodStart(nextPeriodStart: Date, cycleLength: number): FertilityWindowInfo {
  const cycleStartDate = new Date(nextPeriodStart);
  cycleStartDate.setDate(cycleStartDate.getDate() - cycleLength);
  return getFertilityWindowForCycleStart(cycleStartDate, cycleLength);
}

export function getDayInCycleForDate(date: Date, cycleStartDate: Date, cycleLength: number): number {
  const target = new Date(date);
  target.setHours(12, 0, 0, 0);
  const start = new Date(cycleStartDate);
  start.setHours(12, 0, 0, 0);
  const dayDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return ((dayDiff % cycleLength) + cycleLength) % cycleLength + 1;
}

export function getCycleWindowKindForDay(dayInCycle: number, cycleLength: number): CycleWindowKind | null {
  const windows = getCycleWindowDays(cycleLength);

  if (dayInCycle >= windows.ovulation.startDay && dayInCycle <= windows.ovulation.endDay) {
    return 'ovulation';
  }

  if (dayInCycle >= windows.fertile.startDay && dayInCycle <= windows.fertile.endDay) {
    return 'fertile';
  }

  return null;
}

export function isValidPeriodRange(startDate: string, endDate?: string): boolean {
  if (!endDate) return true;
  return parseLocalDate(startDate).getTime() <= parseLocalDate(endDate).getTime();
}

export function isDateInPeriod(date: string, cycle: CycleData): boolean {
  if (!cycle.endDate) return cycle.startDate === date;
  return cycle.startDate <= date && date <= cycle.endDate;
}

export function findPeriodCycleForDate(date: string, cycles: CycleData[]): CycleData | undefined {
  return [...cycles]
    .filter((cycle) => isDateInPeriod(date, cycle))
    .sort((a, b) => parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime())[0];
}

export function findPeriodCycleToEndOnDate(
  date: string,
  cycles: CycleData[],
  maxPeriodLength: number = 14
): CycleData | undefined {
  const targetDate = parseLocalDate(date);

  return [...cycles]
    .filter((cycle) => {
      const startDate = parseLocalDate(cycle.startDate);
      const daysFromStart = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysFromStart >= 0 && daysFromStart < maxPeriodLength;
    })
    .sort((a, b) => parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime())[0];
}

export function getLatestCycleStartOnOrBeforeDate(date: string, cycles: CycleData[]): CycleData | undefined {
  return [...cycles]
    .filter((cycle) => cycle.startDate <= date)
    .sort((a, b) => parseLocalDate(b.startDate).getTime() - parseLocalDate(a.startDate).getTime())[0];
}

export function buildPeriodDateSet(cycles: CycleData[]): Set<string> {
  const dates = new Set<string>();

  cycles.forEach((cycle) => {
    if (!isValidPeriodRange(cycle.startDate, cycle.endDate)) return;

    const start = parseLocalDate(cycle.startDate);
    const end = cycle.endDate ? parseLocalDate(cycle.endDate) : start;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.add(formatDate(new Date(d)));
    }
  });

  return dates;
}

function getDaysBetweenDates(startDate: string, endDate: string): number {
  return Math.floor((parseLocalDate(endDate).getTime() - parseLocalDate(startDate).getTime()) / DAY_MS);
}

export function getCycleDayNumberForDate(
  date: Date,
  options: {
    cycles: CycleData[];
    lastPeriodStart?: string | null;
    cycleLength: number;
  }
): number | null {
  const dateStr = formatDate(date);
  const recordedCycles = [...options.cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const anchorCycle = getLatestCycleStartOnOrBeforeDate(dateStr, recordedCycles);
  const anchorStartDateStr = anchorCycle?.startDate || options.lastPeriodStart;

  if (!anchorStartDateStr || dateStr < anchorStartDateStr) return null;

  const dayFromAnchor = getDaysBetweenDates(anchorStartDateStr, dateStr) + 1;
  const latestRecordedStart = recordedCycles.at(-1)?.startDate;

  // Completed historical cycles keep their actual length, exactly as the trend
  // chart measures the interval between two recorded period starts.
  if (anchorCycle && anchorCycle.startDate !== latestRecordedStart) {
    return dayFromAnchor;
  }

  // The current and future calendar follow the effective length produced by
  // the prediction engine, so each predicted period start resets to day 01.
  const safeCycleLength = Math.max(1, Math.round(options.cycleLength));
  return ((dayFromAnchor - 1) % safeCycleLength + safeCycleLength) % safeCycleLength + 1;
}

function getRecordedPeriodLength(cycle: CycleData, fallbackPeriodLength: number): number {
  if (!cycle.endDate) return fallbackPeriodLength;
  return Math.max(1, getDaysBetweenDates(cycle.startDate, cycle.endDate) + 1);
}

function getPhaseProgressFromCycleDay(
  dayInCurrentCycle: number,
  phase: CyclePhase,
  cycleLength: number,
  periodLength: number
) {
  const ovulationDay = getOvulationDay(cycleLength);
  let phaseDay: number;
  let phaseTotalDays: number;

  switch (phase) {
    case 'menstrual':
      phaseDay = dayInCurrentCycle;
      phaseTotalDays = periodLength;
      break;
    case 'follicular':
      phaseDay = dayInCurrentCycle - periodLength;
      phaseTotalDays = ovulationDay - periodLength - 2;
      break;
    case 'ovulation':
      phaseDay = dayInCurrentCycle - (ovulationDay - 2);
      phaseTotalDays = 5;
      break;
    case 'luteal':
      phaseDay = dayInCurrentCycle - (ovulationDay + 2);
      phaseTotalDays = cycleLength - ovulationDay - 2;
      break;
  }

  return {
    phaseDay: Math.max(1, phaseDay),
    phaseTotalDays: Math.max(1, phaseTotalDays),
  };
}

// 根据周期天数和周期长度计算周期阶段
export function getCyclePhase(dayInCycle: number, cycleLength: number, periodLength: number = 5): CyclePhase {
  const ovulationDay = getOvulationDay(cycleLength); // 排卵通常在下次月经前14天
  
  if (dayInCycle <= periodLength) {
    return 'menstrual';
  } else if (dayInCycle < ovulationDay - 2) {
    return 'follicular';
  } else if (dayInCycle <= ovulationDay + 2) {
    return 'ovulation';
  } else {
    return 'luteal';
  }
}

export function getCyclePhaseInfoForDate(
  date: Date,
  options: {
    cycles: CycleData[];
    lastPeriodStart?: string | null;
    cycleLength: number;
    periodLength: number;
    predictedPeriodDateSet?: Set<string>;
  }
): CyclePhaseInfoForDate | null {
  const dateStr = formatDate(date);
  const recordedCycle = findPeriodCycleForDate(dateStr, options.cycles);
  const anchorCycle = recordedCycle || getLatestCycleStartOnOrBeforeDate(dateStr, options.cycles);
  const anchorStartDateStr = anchorCycle?.startDate || options.lastPeriodStart;

  if (!anchorStartDateStr) return null;

  const safeCycleLength = Math.max(1, Math.round(options.cycleLength));
  let periodLengthUsed = Math.max(1, Math.round(options.periodLength));
  const isRecordedPeriod = Boolean(recordedCycle);
  const isPredictedPeriod = Boolean(!isRecordedPeriod && options.predictedPeriodDateSet?.has(dateStr));
  const dayDiff = getDaysBetweenDates(anchorStartDateStr, dateStr);
  const dayInCycle = dayDiff + 1;
  const dayInCurrentCycle = ((dayDiff % safeCycleLength) + safeCycleLength) % safeCycleLength + 1;

  if (anchorCycle?.endDate && dateStr > anchorCycle.endDate && dayDiff < safeCycleLength) {
    periodLengthUsed = getRecordedPeriodLength(anchorCycle, periodLengthUsed);
  }

  if (recordedCycle) {
    periodLengthUsed = getRecordedPeriodLength(recordedCycle, periodLengthUsed);
  }

  let phase = isRecordedPeriod || isPredictedPeriod
    ? 'menstrual'
    : getCyclePhase(dayInCurrentCycle, safeCycleLength, periodLengthUsed);

  if (
    phase === 'menstrual' &&
    !isRecordedPeriod &&
    !isPredictedPeriod &&
    anchorCycle?.endDate &&
    dateStr > anchorCycle.endDate
  ) {
    // 检查是否在"预期经期"范围内（基于周期长度计算）
    // 这处理了"经期延迟"的情况：预期经期没来，但实际经期推迟了
    // 在这种情况下，预期经期的日子应该保持为 luteal（黄体期），等待经期到来
    const daysSinceAnchor = dayDiff;
    const expectedNextPeriodStart = safeCycleLength; // 从锚定周期开始，下一个预期经期开始的天数
    const expectedNextPeriodEnd = safeCycleLength + periodLengthUsed - 1; // 预期经期结束

    // 如果在预期经期范围内（允许3天的容差），保持为 luteal
    const tolerance = 3;
    const isInExpectedPeriodRange =
      daysSinceAnchor >= expectedNextPeriodStart - tolerance &&
      daysSinceAnchor <= expectedNextPeriodEnd + tolerance;

    if (isInExpectedPeriodRange) {
      phase = 'luteal'; // 经期延迟，保持在黄体期等待
    } else {
      phase = 'follicular';
    }
  }
  const progress = getPhaseProgressFromCycleDay(dayInCurrentCycle, phase, safeCycleLength, periodLengthUsed);

  return {
    phase,
    dayInCycle,
    daysUntilNextPeriod: safeCycleLength - dayInCurrentCycle + 1,
    phaseDay: isRecordedPeriod ? Math.max(1, dayDiff + 1) : progress.phaseDay,
    phaseTotalDays: progress.phaseTotalDays,
    isRecordedPeriod,
    isPredictedPeriod,
    anchorStartDateStr,
    periodLengthUsed,
  };
}

export function atNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

/**
 * The most recent predicted period start on or before `today`, or null while
 * the first prediction is still ahead. Home's "late N days" banner and the
 * widget day table both measure lateness from this date, so it lives here
 * rather than forking per caller.
 */
export function getMostRecentExpectedStart(lastPeriodStart: string, cycleLength: number, today: Date): Date | null {
  if (cycleLength < 1) return null;

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

export function getPhaseInfo(
  currentDate: Date,
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number = 5
): PhaseInfo {
  const diffTime = currentDate.getTime() - lastPeriodStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // 实际天数（从经期开始到现在，不取模，用于显示"第N天"）
  const dayInCycle = diffDays + 1;
  
  // 周期内相对位置（用于判断当前阶段和预测下次经期）
  const dayInCurrentCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength + 1;
  
  const phase = getCyclePhase(dayInCurrentCycle, cycleLength, periodLength);
  const daysUntilNextPeriod = cycleLength - dayInCurrentCycle + 1;
  
  
  // 计算阶段内的天数
  const ovulationDay = getOvulationDay(cycleLength);
  let phaseDay: number;
  let phaseTotalDays: number;
  
  switch (phase) {
    case 'menstrual':
      phaseDay = dayInCurrentCycle;
      phaseTotalDays = periodLength;
      break;
    case 'follicular':
      phaseDay = dayInCurrentCycle - periodLength;
      phaseTotalDays = ovulationDay - periodLength - 2;
      break;
    case 'ovulation':
      phaseDay = dayInCurrentCycle - (ovulationDay - 2);
      phaseTotalDays = 5;
      break;
    case 'luteal':
      phaseDay = dayInCurrentCycle - (ovulationDay + 2);
      phaseTotalDays = cycleLength - ovulationDay - 2;
      break;
  }
  
  return {
    phase,
    dayInCycle,
    daysUntilNextPeriod,
    phaseDay: Math.max(1, phaseDay),
    phaseTotalDays: Math.max(1, phaseTotalDays),
  };
}

export function getPhaseEmoji(phase: CyclePhase, customEmojis?: Record<string, string>): string {
  if (customEmojis && customEmojis[phase]) {
    return customEmojis[phase];
  }
  return zh.phaseEmojis[phase];
}

export function getPhaseName(phase: CyclePhase): string {
  return zh.phases[phase];
}

// 获取经期随机提示语
export function getMenstrualTip(): string {
  const tips = zh.menstrualTips;
  return tips[Math.floor(Math.random() * tips.length)];
}

// 获取时期描述（经期用随机提示语，其他时期用"预计处于xx期的第n天"）
export function getPhaseDescription(phase: CyclePhase, phaseDay?: number): string {
  if (phase === 'menstrual') {
    return getMenstrualTip();
  }
  if (phaseDay !== undefined) {
    return `预计处于${zh.phases[phase]}的第${phaseDay}天`;
  }
  return zh.phaseDescriptions[phase];
}

// 获取序数词后缀
export function getOrdinalSuffix(n: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

// 从历史记录计算平均周期长度（基于相邻周期开始日期之差）
export function calculateAverageCycleLength(cycles: CycleData[]): number {
  if (cycles.length < 2) return 28;
  
  // 按开始日期排序
  const sorted = [...cycles].sort((a, b) => 
    parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  );
  
  // 计算相邻周期之间的天数
  const lengths: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start1 = parseLocalDate(sorted[i].startDate);
    const start2 = parseLocalDate(sorted[i + 1].startDate);
    const diffDays = Math.round((start2.getTime() - start1.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 60) { // 过滤异常值
      lengths.push(diffDays);
    }
  }
  
  if (lengths.length === 0) return 28;
  
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

// 从 cycles 表计算平均经期长度
export function calculateAveragePeriodLength(cycles: CycleData[]): number {
  const periodLengths = cycles
    .filter(c => c.startDate && c.endDate)
    .map(c => {
      const start = parseLocalDate(c.startDate);
      const end = parseLocalDate(c.endDate!);
      return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    })
    .filter(l => l > 0 && l < 15);
  
  if (periodLengths.length === 0) return 5;
  return Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
}

// 预测未来经期
export function predictNextPeriods(
  lastPeriodStart: Date,
  cycleLength: number,
  periodLength: number,
  count: number = 6
): PredictedPeriod[] {
  const predictions: PredictedPeriod[] = [];
  
  for (let i = 1; i <= count; i++) {
    const startDate = new Date(lastPeriodStart);
    startDate.setDate(startDate.getDate() + (cycleLength * i));
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + periodLength - 1);
    
    predictions.push({
      startDate,
      endDate,
      isPrediction: true,
    });
  }
  
  return predictions;
}

// 日期格式化辅助函数（使用本地时间，避免时区问题）
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

export function formatFullDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${year}年${month}月${day}日 ${weekdays[date.getDay()]}`;
}

// 检查是否是今天
export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

// 获取一周的开始（周日）
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

// 获取月份的所有天数
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  
  return days;
}

