import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PhaseInfo, getPhaseEmoji, getPhaseName, getPhaseDescription, formatDisplayDate, formatDate, isBackupOverdue, getDaysSinceBackup, getMenstrualTip, parseLocalDate } from '@/lib/cycle-utils';
import { Settings, CycleData } from '@/lib/db';
import { AlertCircle } from 'lucide-react';
import { zh } from '@/lib/i18n';
import { predictNextCycle } from '@/lib/prediction-utils';

interface HomeProps {
  phaseInfo: PhaseInfo | null;
  settings: Settings | null;
  cycles: CycleData[];
  onDaySelect: (date: string) => void;
  onBackupReminder: () => void;
}

export function Home({ phaseInfo, settings, cycles, onDaySelect, onBackupReminder }: HomeProps) {
  const backupOverdue = useMemo(() => {
    if (!settings) return false;
    return isBackupOverdue(settings.lastBackupDate, settings.backupReminderInterval);
  }, [settings]);

  const daysSinceBackup = useMemo(() => {
    if (!settings) return null;
    const days = getDaysSinceBackup(settings.lastBackupDate);
    return days === Infinity ? null : days;
  }, [settings]);

  // 使用统计预测获取下次经期日期（与统计页面统一）
  const { nextPeriodDate, predictedCycleLength } = useMemo(() => {
    if (!phaseInfo || !settings?.lastPeriodStart) return { nextPeriodDate: null, predictedCycleLength: 28 };
    
    // 使用预测工具计算周期长度
    const prediction = predictNextCycle(cycles);
    const cycleLength = cycles.length >= 2 ? prediction.predictedCycleLength : settings.averageCycleLength;
    
    const lastStart = parseLocalDate(settings.lastPeriodStart);
    const nextStart = new Date(lastStart);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    while (nextStart <= today) {
      nextStart.setDate(nextStart.getDate() + cycleLength);
    }
    
    return { nextPeriodDate: nextStart, predictedCycleLength: cycleLength };
  }, [phaseInfo, settings, cycles]);

  // 生成本周预览
  const weekPreview = useMemo(() => {
    if (!phaseInfo || !settings?.lastPeriodStart) return [];
    
    const days = [];
    const today = new Date();
    
    // 使用预测的周期长度
    const cycleLength = predictedCycleLength;
    const lastStart = parseLocalDate(settings.lastPeriodStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const dateAtNoon = new Date(date);
      dateAtNoon.setHours(12, 0, 0, 0);
      const diffFromStart = Math.floor((dateAtNoon.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
      const dayInCycle = (diffFromStart % cycleLength) + 1;
      const ovulationDay = Math.round(cycleLength - 14);
      
      let phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
      if (dayInCycle <= settings.averagePeriodLength) {
        phase = 'menstrual';
      } else if (dayInCycle < ovulationDay - 2) {
        phase = 'follicular';
      } else if (dayInCycle <= ovulationDay + 2) {
        phase = 'ovulation';
      } else {
        phase = 'luteal';
      }
      
      days.push({
        date,
        dateStr: formatDate(date),
        dayName: zh.calendar.weekdays[date.getDay()],
        dayNum: date.getDate(),
        phase,
        isToday: i === 0,
      });
    }
    
    return days;
  }, [phaseInfo, settings, predictedCycleLength]);

  const phaseColorClass = {
    menstrual: 'bg-phase-menstrual',
    follicular: 'bg-phase-follicular',
    ovulation: 'bg-phase-ovulation',
    luteal: 'bg-phase-luteal',
  };

  const phaseRingColor = {
    menstrual: 'stroke-phase-menstrual',
    follicular: 'stroke-phase-follicular',
    ovulation: 'stroke-phase-ovulation',
    luteal: 'stroke-phase-luteal',
  };

  if (!phaseInfo || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">{zh.common.loading}</div>
      </div>
    );
  }

  const progressPercentage = (phaseInfo.phaseDay / phaseInfo.phaseTotalDays) * 100;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 gradient-soft page-enter">
      {/* 备份提醒 */}
      {backupOverdue && (
        <button
          onClick={onBackupReminder}
          className="w-full mb-4 p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3 text-left btn-press card-hover"
        >
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">建议备份数据</p>
            <p className="text-xs text-muted-foreground">
              {daysSinceBackup === null 
                ? zh.home.neverBackedUp
                : `${zh.home.backupReminder} ${daysSinceBackup} ${zh.home.daysAgo}`}
            </p>
          </div>
        </button>
      )}

      {/* 阶段圆环 */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-56 h-56">
          {/* 背景圆环 */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="112"
              cy="112"
              r="90"
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-muted/50"
            />
            <circle
              cx="112"
              cy="112"
              r="90"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              className={phaseRingColor[phaseInfo.phase]}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          
          {/* 中心内容 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl mb-1">{getPhaseEmoji(phaseInfo.phase, settings?.customPhaseEmojis)}</span>
            <span className="text-2xl font-bold text-foreground">第 {phaseInfo.dayInCycle} 天</span>
            <span className="text-sm text-muted-foreground">{getPhaseName(phaseInfo.phase)}</span>
          </div>
        </div>
        
        <p className="text-center text-muted-foreground mt-4 max-w-xs">
          {getPhaseDescription(phaseInfo.phase, phaseInfo.phaseDay)}
        </p>
      </div>

      {/* 下次经期卡片 */}
      {nextPeriodDate && (
        <Card className="mb-6 border-0 shadow-lg overflow-hidden card-hover">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{zh.home.periodExpected}</p>
              <p className="text-xl font-semibold text-foreground">
                {phaseInfo.daysUntilNextPeriod === 1 
                  ? '明天' 
                  : phaseInfo.daysUntilNextPeriod <= 0 
                    ? '今天或即将到来'
                    : `${phaseInfo.daysUntilNextPeriod} ${zh.home.daysUntil}`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {formatDisplayDate(nextPeriodDate)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 本周预览 */}
      <Card className="mb-6 border-0 shadow-lg card-hover">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">{zh.home.weekPreview}</p>
          <div className="flex justify-between">
            {weekPreview.map((day, i) => (
              <button
                key={i}
                onClick={() => onDaySelect(day.dateStr)}
                className="flex flex-col items-center gap-1 transition-transform active:scale-95"
              >
                <span className="text-xs text-muted-foreground">{day.dayName}</span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 hover:scale-110 ${
                    day.isToday 
                      ? `${phaseColorClass[day.phase]} text-white ring-2 ring-offset-2 ring-primary` 
                      : `${phaseColorClass[day.phase]}/20 text-foreground`
                  }`}
                >
                  {day.dayNum}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
