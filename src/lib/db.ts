import { openDB, DBSchema, IDBPDatabase } from 'idb';

// 类型定义
export interface CycleData {
  id?: number;
  startDate: string; // ISO 日期字符串 YYYY-MM-DD
  endDate?: string;  // ISO 日期字符串 YYYY-MM-DD
  createdAt?: string; // ISO 时间戳
}

// dailyLogs 只存储用户主动记录的内容（症状、心情、备注、经量）
// isPeriod 已移除，经期判断改用 cycles 表
export interface DailyLog {
  id?: number;
  date: string; // ISO 日期字符串 (YYYY-MM-DD)
  flowIntensity?: 'light' | 'medium' | 'heavy';
  symptoms?: string[];
  mood?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
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
  // 自定义时期表情
  customPhaseEmojis?: {
    menstrual?: string;
    follicular?: string;
    ovulation?: string;
    luteal?: string;
  };
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
export async function addCycle(cycle: Omit<CycleData, 'id' | 'createdAt'>): Promise<number> {
  const db = await getDB();
  return db.add('cycles', {
    ...cycle,
    createdAt: new Date().toISOString(),
  } as CycleData);
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

export async function deleteDailyLog(date: string): Promise<void> {
  const db = await getDB();
  const existing = await db.getFromIndex('dailyLogs', 'by-date', date);
  if (existing?.id) {
    await db.delete('dailyLogs', existing.id);
  }
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

  // 标准化 cycles 数据，只保留必要字段
  const normalizedCycles = cycles.map(({ id, startDate, endDate, createdAt }) => ({
    id,
    startDate,
    endDate,
    createdAt: createdAt || new Date().toISOString(),
  }));

  // dailyLogs 不再包含 isPeriod 字段
  const normalizedLogs = dailyLogs.map(({ id, date, flowIntensity, symptoms, mood, notes, createdAt, updatedAt }) => ({
    id,
    date,
    ...(flowIntensity && { flowIntensity }),
    ...(symptoms && symptoms.length > 0 && { symptoms }),
    ...(mood && { mood }),
    ...(notes && { notes }),
    createdAt,
    updatedAt,
  }));

  return {
    version: 2,
    exportDate: new Date().toISOString(),
    settings,
    cycles: normalizedCycles,
    dailyLogs: normalizedLogs,
  };
}

export async function importData(data: BackupData): Promise<void> {
  const db = await getDB();
  
  // 清除现有数据
  await db.clear('cycles');
  await db.clear('dailyLogs');
  
  // 导入周期（标准化格式，不再自动创建 dailyLogs）
  for (const cycle of data.cycles) {
    const cycleToAdd: CycleData = {
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      createdAt: cycle.createdAt || (cycle as any).createdAt || new Date().toISOString(),
    };
    await db.add('cycles', cycleToAdd);
  }
  
  // 导入每日记录（移除 isPeriod 字段，只导入有实际内容的记录）
  for (const log of data.dailyLogs || []) {
    // 从旧数据中提取，忽略 isPeriod
    const { isPeriod, ...logWithoutIsPeriod } = log as any;
    
    // 只有当 log 有实际内容时才导入
    const hasContent = 
      (logWithoutIsPeriod.symptoms && logWithoutIsPeriod.symptoms.length > 0) || 
      logWithoutIsPeriod.mood || 
      logWithoutIsPeriod.notes || 
      logWithoutIsPeriod.flowIntensity;
    
    if (hasContent) {
      const cleanLog: DailyLog = {
        date: logWithoutIsPeriod.date,
        ...(logWithoutIsPeriod.flowIntensity && { flowIntensity: logWithoutIsPeriod.flowIntensity }),
        ...(logWithoutIsPeriod.symptoms && logWithoutIsPeriod.symptoms.length > 0 && { symptoms: logWithoutIsPeriod.symptoms }),
        ...(logWithoutIsPeriod.mood && { mood: logWithoutIsPeriod.mood }),
        ...(logWithoutIsPeriod.notes && { notes: logWithoutIsPeriod.notes }),
        createdAt: logWithoutIsPeriod.createdAt || new Date().toISOString(),
        updatedAt: logWithoutIsPeriod.updatedAt || new Date().toISOString(),
      };
      await db.add('dailyLogs', cleanLog);
    }
  }
  
  // 更新设置（保留部分本地设置）
  const currentSettings = await getSettings();
  
  // 如果导入的数据有settings，使用它；否则基于cycles计算
  if (data.settings) {
    // 导入时清除备份日期，因为导入本身不算备份
    const { lastBackupDate, ...settingsWithoutBackup } = data.settings;
    await updateSettings({
      ...settingsWithoutBackup,
      id: 1,
      persistentStorageGranted: currentSettings.persistentStorageGranted,
      lastBackupDate: undefined, // 明确清除备份日期
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

// 同步 lastPeriodStart 与最新周期记录
export async function syncLastPeriodStart(): Promise<void> {
  const cycles = await getAllCycles();
  if (cycles.length > 0) {
    // 按开始日期降序排序，取最新的
    const sorted = [...cycles].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const latestCycle = sorted[0];
    const currentSettings = await getSettings();
    
    // 仅当 lastPeriodStart 与最新周期不一致时更新
    if (currentSettings.lastPeriodStart !== latestCycle.startDate) {
      await updateSettings({ lastPeriodStart: latestCycle.startDate });
    }
  }
}
