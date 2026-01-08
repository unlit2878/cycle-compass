import { useState, useEffect, useCallback } from 'react';
import {
  getSettings,
  updateSettings,
  getAllCycles,
  addCycle,
  getAllDailyLogs,
  addOrUpdateDailyLog,
  getDailyLog,
  getLatestCycle,
  exportData,
  importData,
  requestPersistentStorage,
  Settings,
  CycleData,
  DailyLog,
  BackupData,
} from '@/lib/db';
import {
  getPhaseInfo,
  calculateAverageCycleLength,
  calculateAveragePeriodLength,
  formatDate,
  PhaseInfo,
} from '@/lib/cycle-utils';

export function useCycleData() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [settingsData, cyclesData, logsData] = await Promise.all([
        getSettings(),
        getAllCycles(),
        getAllDailyLogs(),
      ]);

      setSettings(settingsData);
      setCycles(cyclesData);
      setDailyLogs(logsData);

      // Calculate current phase if we have data
      if (settingsData.lastPeriodStart) {
        const info = getPhaseInfo(
          new Date(),
          new Date(settingsData.lastPeriodStart),
          settingsData.averageCycleLength,
          settingsData.averagePeriodLength
        );
        setPhaseInfo(info);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update settings
  const saveSettings = useCallback(async (updates: Partial<Settings>) => {
    const updated = await updateSettings(updates);
    setSettings(updated);
    
    // Recalculate phase info if relevant settings changed
    if (updates.lastPeriodStart || updates.averageCycleLength || updates.averagePeriodLength) {
      const info = getPhaseInfo(
        new Date(),
        new Date(updated.lastPeriodStart!),
        updated.averageCycleLength,
        updated.averagePeriodLength
      );
      setPhaseInfo(info);
    }
    
    return updated;
  }, []);

  // Complete onboarding
  const completeOnboarding = useCallback(async (lastPeriodStart: string, cycleLength: number) => {
    await addCycle({ startDate: lastPeriodStart });
    await saveSettings({
      onboardingComplete: true,
      lastPeriodStart,
      averageCycleLength: cycleLength,
    });
    await loadData();
  }, [saveSettings, loadData]);

  // Log a day
  const logDay = useCallback(async (
    date: string,
    data: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>
  ) => {
    await addOrUpdateDailyLog({ date, ...data });
    
    // If starting a new period, update cycle data
    if (data.isPeriod) {
      const previousLog = await getDailyLog(
        formatDate(new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000))
      );
      
      // If yesterday wasn't a period day, this is a new period start
      if (!previousLog?.isPeriod) {
        const latestCycle = await getLatestCycle();
        if (latestCycle && latestCycle.startDate !== date) {
          // Calculate cycle length from previous period
          const prevStart = new Date(latestCycle.startDate);
          const newStart = new Date(date);
          const cycleLength = Math.round(
            (newStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Update previous cycle with end date and length
          latestCycle.cycleLength = cycleLength;
          
          // Add new cycle
          await addCycle({ startDate: date });
        }
        
        await saveSettings({ lastPeriodStart: date });
      }
    }
    
    await loadData();
  }, [loadData, saveSettings]);

  // Get log for specific date
  const getLogForDate = useCallback(async (date: string): Promise<DailyLog | undefined> => {
    return getDailyLog(date);
  }, []);

  // Export data for backup
  const backup = useCallback(async (): Promise<BackupData> => {
    const data = await exportData();
    await saveSettings({ lastBackupDate: new Date().toISOString() });
    return data;
  }, [saveSettings]);

  // Import data from backup
  const restore = useCallback(async (data: BackupData): Promise<void> => {
    await importData(data);
    await loadData();
  }, [loadData]);

  // Request persistent storage
  const requestPersistence = useCallback(async (): Promise<boolean> => {
    const granted = await requestPersistentStorage();
    if (granted) {
      await saveSettings({ persistentStorageGranted: true });
    }
    return granted;
  }, [saveSettings]);

  // Calculate statistics
  const statistics = {
    averageCycleLength: calculateAverageCycleLength(cycles),
    averagePeriodLength: calculateAveragePeriodLength(dailyLogs),
    totalCyclesTracked: cycles.length,
    totalDaysLogged: dailyLogs.length,
  };

  return {
    settings,
    cycles,
    dailyLogs,
    loading,
    phaseInfo,
    statistics,
    saveSettings,
    completeOnboarding,
    logDay,
    getLogForDate,
    backup,
    restore,
    requestPersistence,
    refresh: loadData,
  };
}
