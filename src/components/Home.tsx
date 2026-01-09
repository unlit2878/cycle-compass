import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhaseInfo, getPhaseEmoji, getPhaseName, getPhaseDescription, formatDisplayDate, isBackupOverdue, getDaysSinceBackup } from '@/lib/cycle-utils';
import { Settings } from '@/lib/db';
import { Plus, AlertCircle } from 'lucide-react';
import { zh } from '@/lib/i18n';

interface HomeProps {
  phaseInfo: PhaseInfo | null;
  settings: Settings | null;
  onLogToday: () => void;
  onBackupReminder: () => void;
}

export function Home({ phaseInfo, settings, onLogToday, onBackupReminder }: HomeProps) {
  const backupOverdue = useMemo(() => {
    if (!settings) return false;
    return isBackupOverdue(settings.lastBackupDate, settings.backupReminderInterval);
  }, [settings]);

  const daysSinceBackup = useMemo(() => {
    if (!settings) return null;
    const days = getDaysSinceBackup(settings.lastBackupDate);
    return days === Infinity ? null : days;
  }, [settings]);

  // 获取下次经期日期
  const nextPeriodDate = useMemo(() => {
    if (!phaseInfo || !settings?.lastPeriodStart) return null;
    const lastStart = new Date(settings.lastPeriodStart);
    const nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + settings.averageCycleLength);
    return nextStart;
  }, [phaseInfo, settings]);

  // 生成本周预览
  const weekPreview = useMemo(() => {
    if (!phaseInfo || !settings?.lastPeriodStart) return [];
    
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const diffFromStart = Math.floor((date.getTime() - new Date(settings.lastPeriodStart).getTime()) / (1000 * 60 * 60 * 24));
      const dayInCycle = (diffFromStart % settings.averageCycleLength) + 1;
      const ovulationDay = Math.round(settings.averageCycleLength - 14);
      
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
        dayName: zh.calendar.weekdays[date.getDay()],
        dayNum: date.getDate(),
        phase,
        isToday: i === 0,
      });
    }
    
    return days;
  }, [phaseInfo, settings]);

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
            <span className="text-5xl mb-1">{getPhaseEmoji(phaseInfo.phase)}</span>
            <span className="text-2xl font-bold text-foreground">第 {phaseInfo.dayInCycle} 天</span>
            <span className="text-sm text-muted-foreground">{getPhaseName(phaseInfo.phase)}</span>
          </div>
        </div>
        
        <p className="text-center text-muted-foreground mt-4 max-w-xs">
          {getPhaseDescription(phaseInfo.phase)}
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
              <div key={i} className="flex flex-col items-center gap-1">
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 快速记录按钮 */}
      <Button
        onClick={onLogToday}
        className="w-full h-14 text-lg rounded-2xl shadow-lg btn-press transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5"
      >
        <Plus className="mr-2 w-5 h-5" />
        记录今天
      </Button>
    </div>
  );
}
