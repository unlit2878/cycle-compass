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
  
  // 导入周期
  for (const cycle of data.cycles) {
    await db.add('cycles', cycle);
  }
  
  // 导入每日记录
  for (const log of data.dailyLogs) {
    await db.add('dailyLogs', log);
  }
  
  // 更新设置（保留部分本地设置）
  const currentSettings = await getSettings();
  await updateSettings({
    ...data.settings,
    id: 1,
    persistentStorageGranted: currentSettings.persistentStorageGranted,
  });
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
