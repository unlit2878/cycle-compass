import { CycleData, DailyLog } from './db';

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

// Calculate cycle phase based on day in cycle and cycle length
export function getCyclePhase(dayInCycle: number, cycleLength: number): CyclePhase {
  const ovulationDay = Math.round(cycleLength - 14); // Ovulation typically 14 days before next period
  
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
  const dayInCycle = (diffDays % cycleLength) + 1;
  
  const phase = getCyclePhase(dayInCycle, cycleLength);
  const daysUntilNextPeriod = cycleLength - dayInCycle + 1;
  
  // Calculate phase-specific day
  const ovulationDay = Math.round(cycleLength - 14);
  let phaseDay: number;
  let phaseTotalDays: number;
  
  switch (phase) {
    case 'menstrual':
      phaseDay = dayInCycle;
      phaseTotalDays = periodLength;
      break;
    case 'follicular':
      phaseDay = dayInCycle - periodLength;
      phaseTotalDays = ovulationDay - periodLength - 2;
      break;
    case 'ovulation':
      phaseDay = dayInCycle - (ovulationDay - 2);
      phaseTotalDays = 5;
      break;
    case 'luteal':
      phaseDay = dayInCycle - (ovulationDay + 2);
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

export function getPhaseEmoji(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return '🔴';
    case 'follicular': return '🌸';
    case 'ovulation': return '💜';
    case 'luteal': return '🌙';
  }
}

export function getPhaseName(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual': return 'Menstrual';
    case 'follicular': return 'Follicular';
    case 'ovulation': return 'Ovulation';
    case 'luteal': return 'Luteal';
  }
}

export function getPhaseDescription(phase: CyclePhase): string {
  switch (phase) {
    case 'menstrual':
      return 'Your body is shedding the uterine lining. Rest and self-care are important.';
    case 'follicular':
      return 'Energy levels are rising as your body prepares for ovulation.';
    case 'ovulation':
      return 'Peak fertility window. You may feel more energetic and social.';
    case 'luteal':
      return 'Your body is preparing for the next cycle. PMS symptoms may occur.';
  }
}

// Calculate average cycle length from history
export function calculateAverageCycleLength(cycles: CycleData[]): number {
  if (cycles.length < 2) return 28;
  
  const lengths = cycles
    .filter(c => c.cycleLength)
    .map(c => c.cycleLength!);
  
  if (lengths.length === 0) return 28;
  
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

// Calculate average period length from daily logs
export function calculateAveragePeriodLength(logs: DailyLog[]): number {
  const periodDays = logs.filter(l => l.isPeriod);
  if (periodDays.length === 0) return 5;
  
  // Group consecutive period days
  const sortedDates = periodDays.map(l => l.date).sort();
  let periodLengths: number[] = [];
  let currentLength = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      currentLength++;
    } else {
      if (currentLength >= 2) {
        periodLengths.push(currentLength);
      }
      currentLength = 1;
    }
  }
  
  if (currentLength >= 2) {
    periodLengths.push(currentLength);
  }
  
  if (periodLengths.length === 0) return 5;
  return Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
}

// Predict future periods
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

// Format date helpers
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// Check if date is today
export function isToday(date: Date): boolean {
  const today = new Date();
  return formatDate(date) === formatDate(today);
}

// Get start of week (Sunday)
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

// Get days in month
export function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  
  return days;
}

// Check if backup is overdue
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
