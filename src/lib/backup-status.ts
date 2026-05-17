import type { Settings } from './db';

export interface BackupStatus {
  hasBackup: boolean;
  daysSinceBackup: number | null;
  isOverdue: boolean;
  settingsText: string;
  homeReminderText: string;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getReminderThreshold(interval: Settings['backupReminderInterval']): number {
  return interval === 'monthly' ? 30 : 7;
}

export function getBackupStatus(
  lastBackupDate: string | undefined,
  interval: Settings['backupReminderInterval'],
  now: Date = new Date()
): BackupStatus {
  if (!lastBackupDate) {
    return {
      hasBackup: false,
      daysSinceBackup: null,
      isOverdue: true,
      settingsText: '从未备份',
      homeReminderText: '你还没有备份过',
    };
  }

  const lastBackup = new Date(lastBackupDate);
  if (Number.isNaN(lastBackup.getTime())) {
    return {
      hasBackup: false,
      daysSinceBackup: null,
      isOverdue: true,
      settingsText: '从未备份',
      homeReminderText: '你还没有备份过',
    };
  }

  const diffDays = Math.max(
    0,
    Math.floor((startOfLocalDay(now).getTime() - startOfLocalDay(lastBackup).getTime()) / DAY_MS)
  );

  return {
    hasBackup: true,
    daysSinceBackup: diffDays,
    isOverdue: diffDays >= getReminderThreshold(interval),
    settingsText: diffDays === 0 ? '今天已备份' : `${diffDays} 天前已备份`,
    homeReminderText: diffDays === 0 ? '今天已备份' : `上次备份 ${diffDays} 天前`,
  };
}
