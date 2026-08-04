import { useState, useEffect, useCallback } from 'react';
import {
  getSettings,
  updateSettings,
  getAllCycles,
  addCycle,
  getAllDailyLogs,
  addOrUpdateDailyLog,
  getDailyLog,
  deleteDailyLog as deleteDailyLogFromDB,
  exportData,
  importData,
  requestPersistentStorage,
  syncLastPeriodStart,
  Settings,
  CycleData,
  DailyLog,
  BackupData,
} from '@/lib/db';
import { getBackupStatus } from '@/lib/backup-status';
import { createCycleModel, CycleModel } from '@/lib/cycle-engine';
import { buildWidgetSnapshot } from '@/lib/widget-snapshot';
import { syncWidgetSnapshot } from '@/lib/widget-sync';

export function useCycleData() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cycles, setCycles] = useState<CycleData[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycleModel, setCycleModel] = useState<CycleModel | null>(null);

  // 加载所有数据
  const loadData = useCallback(async () => {
    try {
      // 先同步 lastPeriodStart 与最新周期记录
      await syncLastPeriodStart();
      
      const [settingsData, cyclesData, logsData] = await Promise.all([
        getSettings(),
        getAllCycles(),
        getAllDailyLogs(),
      ]);

      setSettings(settingsData);
      setCycles(cyclesData);
      setDailyLogs(logsData);
      setCycleModel(createCycleModel(settingsData, cyclesData, logsData));
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep the native widget in step with every model refresh. On web/PWA this
  // resolves immediately without touching storage or requiring a plugin.
  useEffect(() => {
    if (loading) return;
    void syncWidgetSnapshot(buildWidgetSnapshot(cycleModel, cycles));
  }, [cycleModel, cycles, loading]);

  // 更新设置
  const saveSettings = useCallback(async (updates: Partial<Settings>) => {
    const updated = await updateSettings(updates);

    setSettings(updated);
    setCycleModel(createCycleModel(updated, cycles, dailyLogs));
    
    return updated;
  }, [cycles, dailyLogs]);

  // 完成引导设置
  const completeOnboarding = useCallback(async (lastPeriodStart: string, cycleLength: number, periodLength: number = 5, lastPeriodEnd?: string) => {
    await updateSettings({
      lastPeriodStart,
      averageCycleLength: cycleLength,
      averagePeriodLength: periodLength,
      onboardingComplete: true,
    });
    
    // 如果有结束日期则创建初始周期记录（不再存储 cycleLength）
    if (lastPeriodEnd) {
      await addCycle({
        startDate: lastPeriodStart,
        endDate: lastPeriodEnd,
      });
    }
    
    await loadData();
  }, [loadData]);

  // 记录某一天（接受 YYYY-MM-DD 格式的日期字符串）
  const logDay = useCallback(async (date: string, log: Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>) => {
    await addOrUpdateDailyLog({
      date,
      ...log,
    });
    await loadData();
  }, [loadData]);

  // 获取特定日期的记录（接受 YYYY-MM-DD 格式的日期字符串）
  const getLogForDate = useCallback(async (date: string): Promise<DailyLog | undefined> => {
    return getDailyLog(date);
  }, []);

  // 删除特定日期的记录
  const deleteLog = useCallback(async (date: string): Promise<void> => {
    await deleteDailyLogFromDB(date);
    await loadData();
  }, [loadData]);

  // 备份数据
  const backup = useCallback(async (): Promise<BackupData> => {
    return exportData();
  }, []);

  // 恢复数据
  const restore = useCallback(async (data: BackupData): Promise<void> => {
    await importData(data);
    await loadData();
  }, [loadData]);

  // 请求持久存储
  const requestPersistence = useCallback(async (): Promise<boolean> => {
    const granted = await requestPersistentStorage();
    if (granted) {
      await saveSettings({ persistentStorageGranted: true });
    }
    return granted;
  }, [saveSettings]);

  const statistics = cycleModel?.analytics || {
    averageCycleLength: settings?.averageCycleLength || 28,
    averagePeriodLength: settings?.averagePeriodLength || 5,
    totalCyclesTracked: cycles.length,
    totalDaysLogged: dailyLogs.length,
    cycleLength: {
      value: settings?.averageCycleLength || 28,
      source: 'settings' as const,
      sampleSize: 0,
      ignoredCount: 0,
      outlierCount: 0,
      confidence: 'low' as const,
    },
    periodLength: {
      value: settings?.averagePeriodLength || 5,
      source: 'settings' as const,
      sampleSize: 0,
      ignoredCount: 0,
      outlierCount: 0,
      confidence: 'low' as const,
    },
    cycleLengthRange: null,
    periodLengthRange: null,
    regularity: null,
    predictionAccuracy: { predictions: [], avgError: 0, accuracyRate: 0, windowHitRate: 0 },
  };
  const backupStatus = settings
    ? getBackupStatus(settings.lastBackupDate, settings.backupReminderInterval)
    : null;

  return {
    settings,
    cycles,
    dailyLogs,
    loading,
    cycleModel,
    backupStatus,
    phaseInfo: cycleModel?.currentPhase || null,
    statistics,
    saveSettings,
    completeOnboarding,
    logDay,
    getLogForDate,
    deleteLog,
    backup,
    restore,
    requestPersistence,
    refresh: loadData,
  };
}
