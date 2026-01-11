import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 类型定义
export interface CycleData {
  id?: number;
  startDate: string; // ISO 日期字符串
  endDate?: string;
  cycleLength?: number;
}

export interface DailyLog {
  id?: number;
  date: string; // ISO 日期字符串 (YYYY-MM-DD)
  isPeriod: boolean;
  flowIntensity?: 'light' | 'medium' | 'heavy';
  symptoms: string[];
  mood?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: number;
  onboardingComplete: boolean;
  lastPeriodStart?: string;
  averageCycleLength: number;
  averagePeriodLength: number;
  reminderPeriodApproaching: boolean;
  reminderPeriodDays: number;
  reminderOvulation: boolean;
  reminderDailyLog: boolean;
  reminderDailyLogTime?: string;
  darkMode: boolean;
  backupReminderInterval: 'weekly' | 'monthly';
  lastBackupDate?: string;
  persistentStorageGranted: boolean;
}

interface MyCycleDB extends DBSchema {
  cycles: {
    key: number;
    value: CycleData;
    indexes: { 'by-startDate': string };
  };
  dailyLogs: {
    key: number;
    value: DailyLog;
    indexes: { 'by-date': string };
  };
  settings: {
    key: number;
    value: Settings;
  };
}

const DB_NAME = 'mycycle-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<MyCycleDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MyCycleDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MyCycleDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 周期存储
      if (!db.objectStoreNames.contains('cycles')) {
        const cyclesStore = db.createObjectStore('cycles', {
          keyPath: 'id',
          autoIncrement: true,
        });
        cyclesStore.createIndex('by-startDate', 'startDate');
      }

      // 每日记录存储
      if (!db.objectStoreNames.contains('dailyLogs')) {
        const logsStore = db.createObjectStore('dailyLogs', {
          keyPath: 'id',
          autoIncrement: true,
        });
        logsStore.createIndex('by-date', 'date');
      }

      // 设置存储
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// 设置操作
export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 1);
  
  if (!settings) {
    const defaultSettings: Settings = {
      id: 1,
      onboardingComplete: false,
      averageCycleLength: 28,
      averagePeriodLength: 5,
      reminderPeriodApproaching: true,
      reminderPeriodDays: 2,
      reminderOvulation: false,
      reminderDailyLog: false,
      darkMode: false,
      backupReminderInterval: 'weekly',
      persistentStorageGranted: false,
    };
    await db.put('settings', defaultSettings);
    return defaultSettings;
  }
  
  return settings;
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const db = await getDB();
  const current = await getSettings();
  const updated = { ...current, ...updates };
  await db.put('settings', updated);
  return updated;
}

// 周期操作
export async function addCycle(cycle: Omit<CycleData, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('cycles', cycle as CycleData);
}

export async function updateCycle(id: number, updates: Partial<CycleData>): Promise<void> {
  const db = await getDB();
  const cycle = await db.get('cycles', id);
  if (cycle) {
    await db.put('cycles', { ...cycle, ...updates });
  }
}

export async function getAllCycles(): Promise<CycleData[]> {
  const db = await getDB();
  return db.getAllFromIndex('cycles', 'by-startDate');
}

export async function getLatestCycle(): Promise<CycleData | undefined> {
  const cycles = await getAllCycles();
  return cycles[cycles.length - 1];
}

export async function deleteCycle(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('cycles', id);
}

export async function getCycleByDate(date: string): Promise<CycleData | undefined> {
  const cycles = await getAllCycles();
  return cycles.find(cycle => {
    if (cycle.startDate === date) return true;
    if (cycle.endDate === date) return true;
    if (cycle.startDate <= date && cycle.endDate && cycle.endDate >= date) return true;
    return false;
  });
}

// 每日记录操作
export async function addOrUpdateDailyLog(log: Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDB();
  const existing = await db.getFromIndex('dailyLogs', 'by-date', log.date);
  const now = new Date().toISOString();
  
  if (existing) {
    await db.put('dailyLogs', {
      ...existing,
      ...log,
      updatedAt: now,
    });
    return existing.id!;
  } else {
    return db.add('dailyLogs', {
      ...log,
      createdAt: now,
      updatedAt: now,
    } as DailyLog);
  }
}

export async function getDailyLog(date: string): Promise<DailyLog | undefined> {
  const db = await getDB();
  return db.getFromIndex('dailyLogs', 'by-date', date);
}

export async function getAllDailyLogs(): Promise<DailyLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('dailyLogs', 'by-date');
}

export async function getDailyLogsInRange(startDate: string, endDate: string): Promise<DailyLog[]> {
  const allLogs = await getAllDailyLogs();
  return allLogs.filter(log => log.date >= startDate && log.date <= endDate);
}

// 备份和恢复
export interface BackupData {
  version: number;
  exportDate: string;
  settings: Settings;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
}

export async function exportData(): Promise<BackupData> {
  const [settings, cycles, dailyLogs] = await Promise.all([
    getSettings(),
    getAllCycles(),
    getAllDailyLogs(),
  ]);

  return {
    version: 1,
    exportDate: new Date().toISOString(),
    settings,
    cycles,
    dailyLogs,
  };
}

export async function importData(data: BackupData): Promise<void> {
  const db = await getDB();
  
  // 清除现有数据
  await db.clear('cycles');
  await db.clear('dailyLogs');
  
  // 导入周期，同时为每个周期创建对应的dailyLogs记录
  for (const cycle of data.cycles) {
    // 兼容旧格式（可能有duration字段但没有cycleLength）
    const cycleToAdd = {
      ...cycle,
      cycleLength: cycle.cycleLength || (cycle as any).duration,
    };
    await db.add('cycles', cycleToAdd);
    
    // 如果有开始和结束日期，自动创建对应的每日经期记录
    if (cycle.startDate && cycle.endDate) {
      const start = new Date(cycle.startDate);
      const end = new Date(cycle.endDate);
      const now = new Date().toISOString();
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        // 检查是否已存在该日期的记录
        const existing = await db.getFromIndex('dailyLogs', 'by-date', dateStr);
        if (!existing) {
          await db.add('dailyLogs', {
            date: dateStr,
            isPeriod: true,
            flowIntensity: 'medium',
            symptoms: [],
            createdAt: now,
            updatedAt: now,
          } as DailyLog);
        }
      }
    }
  }
  
  // 导入每日记录（覆盖已存在的）
  for (const log of data.dailyLogs || []) {
    const existing = await db.getFromIndex('dailyLogs', 'by-date', log.date);
    if (existing) {
      await db.put('dailyLogs', { ...existing, ...log });
    } else {
      await db.add('dailyLogs', log);
    }
  }
  
  // 更新设置（保留部分本地设置）
  const currentSettings = await getSettings();
  
  // 如果导入的数据有settings，使用它；否则基于cycles计算
  if (data.settings) {
    await updateSettings({
      ...data.settings,
      id: 1,
      persistentStorageGranted: currentSettings.persistentStorageGranted,
    });
  } else if (data.cycles && data.cycles.length > 0) {
    // 自动计算设置
    const sortedCycles = [...data.cycles].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const latestCycle = sortedCycles[0];
    
    // 计算平均周期长度
    let avgCycleLength = 28;
    if (sortedCycles.length >= 2) {
      const lengths: number[] = [];
      for (let i = 0; i < sortedCycles.length - 1; i++) {
        const diff = Math.floor(
          (new Date(sortedCycles[i].startDate).getTime() - new Date(sortedCycles[i + 1].startDate).getTime()) 
          / (1000 * 60 * 60 * 24)
        );
        if (diff > 0 && diff < 60) lengths.push(diff);
      }
      if (lengths.length > 0) {
        avgCycleLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      }
    }
    
    // 计算平均经期长度
    let avgPeriodLength = 5;
    const periodLengths = data.cycles
      .filter(c => c.startDate && c.endDate)
      .map(c => {
        const start = new Date(c.startDate);
        const end = new Date(c.endDate!);
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      })
      .filter(l => l > 0 && l < 15);
    if (periodLengths.length > 0) {
      avgPeriodLength = Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length);
    }
    
    await updateSettings({
      onboardingComplete: true,
      lastPeriodStart: latestCycle.startDate,
      averageCycleLength: avgCycleLength,
      averagePeriodLength: avgPeriodLength,
      persistentStorageGranted: currentSettings.persistentStorageGranted,
    });
  }
}

// 请求持久存储
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    await updateSettings({ persistentStorageGranted: granted });
    return granted;
  }
  return false;
}

export async function checkStoragePersistence(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persisted) {
    return navigator.storage.persisted();
  }
  return false;
}
