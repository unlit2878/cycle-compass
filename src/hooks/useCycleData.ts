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
  parseLocalDate,
} from '@/lib/cycle-utils';
import { predictNextCycle } from '@/lib/prediction-utils';

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

      // 如果有数据则计算当前阶段（使用统计预测的周期长度）
      if (settingsData.lastPeriodStart) {
        // 使用预测工具计算周期长度（与首页统一）
        const prediction = predictNextCycle(cyclesData);
        const cycleLength = cyclesData.length >= 2 ? prediction.predictedCycleLength : settingsData.averageCycleLength;
        const currentDate = new Date();
        currentDate.setHours(12, 0, 0, 0);
        
        const info = getPhaseInfo(
          currentDate,
          parseLocalDate(settingsData.lastPeriodStart),
          cycleLength,
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
    
    // 如果相关设置变更则重新计算阶段信息（使用统计预测的周期长度）
    if (updates.lastPeriodStart || updates.averageCycleLength || updates.averagePeriodLength) {
      const allCycles = await getAllCycles();
      const prediction = predictNextCycle(allCycles);
      const cycleLength = allCycles.length >= 2 ? prediction.predictedCycleLength : updated.averageCycleLength;
      const currentDate = new Date();
      currentDate.setHours(12, 0, 0, 0);
      
      const info = getPhaseInfo(
        currentDate,
        parseLocalDate(updated.lastPeriodStart!),
        cycleLength,
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

  // 计算统计数据（改用 cycles 计算经期长度）
  const statistics = {
    averageCycleLength: calculateAverageCycleLength(cycles),
    averagePeriodLength: calculateAveragePeriodLength(cycles),
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
    deleteLog,
    backup,
    restore,
    requestPersistence,
    refresh: loadData,
  };
}
