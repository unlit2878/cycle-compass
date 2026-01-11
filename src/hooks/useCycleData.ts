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
  syncLastPeriodStart,
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

      // 如果有数据则计算当前阶段
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
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 更新设置
  const saveSettings = useCallback(async (updates: Partial<Settings>) => {
    const updated = await updateSettings(updates);
    setSettings(updated);
    
    // 如果相关设置变更则重新计算阶段信息
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

  // 完成引导设置
  const completeOnboarding = useCallback(async (lastPeriodStart: string, cycleLength: number, periodLength: number = 5, lastPeriodEnd?: string) => {
    await updateSettings({
      lastPeriodStart,
      averageCycleLength: cycleLength,
      averagePeriodLength: periodLength,
      onboardingComplete: true,
    });
    
    // 如果有结束日期则创建初始周期记录
    if (lastPeriodEnd) {
      await addCycle({
        startDate: lastPeriodStart,
        endDate: lastPeriodEnd,
        cycleLength,
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

  // 计算统计数据
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
