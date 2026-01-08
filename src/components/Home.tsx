import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PhaseInfo, getPhaseEmoji, getPhaseName, getPhaseDescription, formatDisplayDate, isBackupOverdue, getDaysSinceBackup } from '@/lib/cycle-utils';
import { Settings } from '@/lib/db';
import { Plus, AlertCircle } from 'lucide-react';

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

  // Get next period date
  const nextPeriodDate = useMemo(() => {
    if (!phaseInfo || !settings?.lastPeriodStart) return null;
    const lastStart = new Date(settings.lastPeriodStart);
    const nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + settings.averageCycleLength);
    return nextStart;
  }, [phaseInfo, settings]);

  // Generate week preview
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
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
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
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const progressPercentage = (phaseInfo.phaseDay / phaseInfo.phaseTotalDays) * 100;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 gradient-soft">
      {/* Backup reminder */}
      {backupOverdue && (
        <button
          onClick={onBackupReminder}
          className="w-full mb-4 p-3 rounded-xl bg-warning/10 border border-warning/30 flex items-center gap-3 text-left"
        >
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Backup recommended</p>
            <p className="text-xs text-muted-foreground">
              {daysSinceBackup === null 
                ? "You haven't backed up your data yet"
                : `Last backup: ${daysSinceBackup} days ago`}
            </p>
          </div>
        </button>
      )}

      {/* Phase Circle */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative w-56 h-56">
          {/* Background circle */}
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
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl mb-1">{getPhaseEmoji(phaseInfo.phase)}</span>
            <span className="text-2xl font-bold text-foreground">Day {phaseInfo.dayInCycle}</span>
            <span className="text-sm text-muted-foreground">{getPhaseName(phaseInfo.phase)} Phase</span>
          </div>
        </div>
        
        <p className="text-center text-muted-foreground mt-4 max-w-xs">
          {getPhaseDescription(phaseInfo.phase)}
        </p>
      </div>

      {/* Next Period Card */}
      {nextPeriodDate && (
        <Card className="mb-6 border-0 shadow-lg overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Next period expected</p>
              <p className="text-xl font-semibold text-foreground">
                {phaseInfo.daysUntilNextPeriod === 1 
                  ? 'Tomorrow' 
                  : phaseInfo.daysUntilNextPeriod <= 0 
                    ? 'Today or any day now'
                    : `In ${phaseInfo.daysUntilNextPeriod} days`}
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

      {/* Week Preview */}
      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">This week</p>
          <div className="flex justify-between">
            {weekPreview.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{day.dayName}</span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
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

      {/* Quick Log Button */}
      <Button
        onClick={onLogToday}
        className="w-full h-14 text-lg rounded-2xl shadow-lg"
      >
        <Plus className="mr-2 w-5 h-5" />
        Log Today
      </Button>
    </div>
  );
}
