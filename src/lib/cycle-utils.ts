import { CycleData } from './db';
import { zh } from './i18n';

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

export interface PhaseInfo {
  phase: CyclePhase;
  dayInCycle: number;
  daysUntilNextPeriod: number;
  phaseDay: number;
  phaseTotalDays: number;
}

export interface PredictedPeriod {
  startDate: Date;
  endDate: Date;
  isPrediction: boolean;
}

// 根据周期天数和周期长度计算周期阶段
export function getCyclePhase(dayInCycle: number, cycleLength: number): CyclePhase {
  const ovulationDay = Math.round(cycleLength - 14); // 排卵通常在下次月经前14天
  
  if (dayInCycle <= 5) {
    return 'menstrual';
  } else if (dayInCycle < ovulationDay - 2) {
    return 'follicular';
  } else if (dayInCycle <= ovulationDay + 2) {
    return 'ovulation';
  } else {
    return 'luteal';
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
  
  const phase = getCyclePhase(dayInCurrentCycle, cycleLength);
  const daysUntilNextPeriod = cycleLength - dayInCurrentCycle + 1;
  
  
  // 计算阶段内的天数
  const ovulationDay = Math.round(cycleLength - 14);
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

// 检查备份是否过期
export function isBackupOverdue(lastBackupDate: string | undefined, interval: 'weekly' | 'monthly'): boolean {
  if (!lastBackupDate) return true;
  
  const lastBackup = new Date(lastBackupDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
  
  if (interval === 'weekly') {
    return diffDays >= 7;
  } else {
    return diffDays >= 30;
  }
}

export function getDaysSinceBackup(lastBackupDate: string | undefined): number {
  if (!lastBackupDate) return Infinity;
  const lastBackup = new Date(lastBackupDate);
  const now = new Date();
  return Math.floor((now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24));
}
