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
  const completeOnboarding = useCallback(async (lastPeriodStart: string, cycleLength: number, periodLength: number = 5, lastPeriodEnd?: string) => {
    const newSettings: Settings = {
      id: 'main',
      lastPeriodStart,
      averageCycleLength: cycleLength,
      averagePeriodLength: periodLength,
      onboardingComplete: true,
      darkMode: false,
    };
    await saveSettingsToDb(newSettings);
    
    // Create initial cycle record
    const initialCycle: CycleData = {
      id: `cycle_${Date.now()}`,
      startDate: lastPeriodStart,
      endDate: lastPeriodEnd,
      cycleLength,
    };
    await saveCycle(initialCycle);
    
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
