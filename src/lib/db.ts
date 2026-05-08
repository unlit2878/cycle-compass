import { DBSchema, IDBPDatabase, openDB } from 'idb';

export interface CycleData {
  id?: number;
  startDate: string;
  endDate?: string;
  createdAt?: string;
}

export type FlowIntensity = 'very_light' | 'light' | 'medium' | 'heavy' | 'very_heavy';
export type FlowColor = 'deep_red' | 'fresh_red' | 'dark_red' | 'brown' | 'other';
export type PainLevel = 'none' | 'mild' | 'moderate' | 'severe';

export interface DailyLog {
  id?: number;
  date: string;
  flowIntensity?: FlowIntensity;
  flowColor?: FlowColor;
  painLevel?: PainLevel;
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
const MIN_CYCLE_START_GAP_DAYS = 18;

let dbInstance: IDBPDatabase<MyCycleDB> | null = null;

const flowIntensityAliases: Record<string, FlowIntensity> = {
  very_light: 'very_light',
  veryLight: 'very_light',
  minimal: 'very_light',
  scant: 'very_light',
  极少: 'very_light',
  light: 'light',
  low: 'light',
  少: 'light',
  少量: 'light',
  medium: 'medium',
  normal: 'medium',
  moderate: 'medium',
  中: 'medium',
  中等: 'medium',
  heavy: 'heavy',
  high: 'heavy',
  多: 'heavy',
  较多: 'heavy',
  very_heavy: 'very_heavy',
  veryHeavy: 'very_heavy',
  extra_heavy: 'very_heavy',
  very_high: 'very_heavy',
  非常多: 'very_heavy',
};

export function normalizeFlowIntensity(value?: string): FlowIntensity | undefined {
  if (!value) return undefined;
  return flowIntensityAliases[value] || undefined;
}

const painLevelAliases: Record<string, PainLevel> = {
  none: 'none',
  no_pain: 'none',
  noPain: 'none',
  无: 'none',
  mild: 'mild',
  light: 'mild',
  slight: 'mild',
  轻微: 'mild',
  moderate: 'moderate',
  medium: 'moderate',
  中等: 'moderate',
  severe: 'severe',
  heavy: 'severe',
  严重: 'severe',
};

export function normalizePainLevel(value?: string): PainLevel | undefined {
  if (!value) return undefined;
  return painLevelAliases[value] || undefined;
}

function hasDailyLogContent(log: Partial<DailyLog>): boolean {
  return Boolean(
    log.flowIntensity ||
      log.flowColor ||
      log.painLevel ||
      log.mood ||
      (log.notes && log.notes.trim().length > 0) ||
      (log.symptoms && log.symptoms.length > 0)
  );
}

function isValidDateRange(startDate: string, endDate?: string): boolean {
  return !endDate || startDate <= endDate;
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round(
    (new Date(`${endDate}T12:00:00`).getTime() - new Date(`${startDate}T12:00:00`).getTime()) /
      (1000 * 60 * 60 * 24)
  );
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampPeriodLength(value: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(14, Math.max(1, Math.round(value)));
}

function isCycleStartConflict(firstDate: string, secondDate: string): boolean {
  return Math.abs(daysBetween(firstDate, secondDate)) < MIN_CYCLE_START_GAP_DAYS;
}

export function normalizeCycleTimeline(cycles: CycleData[]): CycleData[] {
  const normalized: CycleData[] = [];
  const sorted = [...cycles]
    .filter((cycle) => cycle.startDate && isValidDateRange(cycle.startDate, cycle.endDate))
    .sort((a, b) => {
      const startDiff = a.startDate.localeCompare(b.startDate);
      if (startDiff !== 0) return startDiff;
      return (a.id || 0) - (b.id || 0);
    });

  sorted.forEach((cycle) => {
    const previous = normalized[normalized.length - 1];
    if (!previous) {
      normalized.push(cycle);
      return;
    }

    const tooCloseToPreviousStart = isCycleStartConflict(previous.startDate, cycle.startDate);
    const startsInsidePreviousPeriod = Boolean(previous.endDate && cycle.startDate <= previous.endDate);

    if (tooCloseToPreviousStart || startsInsidePreviousPeriod) {
      return;
    }

    normalized.push(cycle);
  });

  return normalized;
}

export async function getDB(): Promise<IDBPDatabase<MyCycleDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<MyCycleDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cycles')) {
        const cyclesStore = db.createObjectStore('cycles', {
          keyPath: 'id',
          autoIncrement: true,
        });
        cyclesStore.createIndex('by-startDate', 'startDate');
      }

      if (!db.objectStoreNames.contains('dailyLogs')) {
        const logsStore = db.createObjectStore('dailyLogs', {
          keyPath: 'id',
          autoIncrement: true,
        });
        logsStore.createIndex('by-date', 'date');
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

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

export async function addCycle(cycle: Omit<CycleData, 'id' | 'createdAt'>): Promise<number> {
  if (!isValidDateRange(cycle.startDate, cycle.endDate)) {
    throw new Error('Period end date cannot be before the start date.');
  }

  const db = await getDB();
  const existing = await db.getFromIndex('cycles', 'by-startDate', cycle.startDate);

  if (existing?.id) {
    await db.put('cycles', { ...existing, ...cycle });
    return existing.id;
  }

  return db.add('cycles', {
    ...cycle,
    createdAt: new Date().toISOString(),
  });
}

export async function savePeriodStart(
  startDate: string,
  endDate: string,
  preferredCycleId?: number
): Promise<number> {
  if (!isValidDateRange(startDate, endDate)) {
    throw new Error('Period end date cannot be before the start date.');
  }

  const db = await getDB();
  const cycles = await db.getAllFromIndex('cycles', 'by-startDate');
  const exactCycle = cycles.find((cycle) => cycle.startDate === startDate);
  const preferredCycle = preferredCycleId ? cycles.find((cycle) => cycle.id === preferredCycleId) : undefined;
  const nearbyCycle = cycles
    .filter((cycle) => !preferredCycleId || cycle.id !== preferredCycleId)
    .filter((cycle) => isCycleStartConflict(cycle.startDate, startDate))
    .sort((a, b) => Math.abs(daysBetween(a.startDate, startDate)) - Math.abs(daysBetween(b.startDate, startDate)))[0];
  const targetCycle = exactCycle || preferredCycle || nearbyCycle;

  let savedId: number;
  if (targetCycle?.id) {
    savedId = targetCycle.id;
    await db.put('cycles', {
      ...targetCycle,
      startDate,
      endDate,
    });
  } else {
    savedId = await db.add('cycles', {
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    });
  }

  const refreshedCycles = await db.getAllFromIndex('cycles', 'by-startDate');
  await Promise.all(
    refreshedCycles
      .filter((cycle) => cycle.id && cycle.id !== savedId && isCycleStartConflict(cycle.startDate, startDate))
      .map((cycle) => db.delete('cycles', cycle.id!))
  );

  return savedId;
}

export async function updateCycle(id: number, updates: Partial<CycleData>): Promise<void> {
  const db = await getDB();
  const cycle = await db.get('cycles', id);
  if (!cycle) return;

  const updated = { ...cycle, ...updates };
  if (!isValidDateRange(updated.startDate, updated.endDate)) {
    throw new Error('Period end date cannot be before the start date.');
  }
  await db.put('cycles', updated);
}

export async function syncLatestCycleToPeriodLength(
  previousPeriodLength: number,
  nextPeriodLength: number
): Promise<void> {
  const db = await getDB();
  const cycles = await getAllCycles();
  const latestCycle = cycles[cycles.length - 1];
  if (!latestCycle?.id) return;

  const previousLength = clampPeriodLength(previousPeriodLength);
  const nextLength = clampPeriodLength(nextPeriodLength);
  if (previousLength === nextLength) return;

  const currentLength = latestCycle.endDate ? daysBetween(latestCycle.startDate, latestCycle.endDate) + 1 : 1;
  if (latestCycle.endDate && currentLength !== previousLength) return;

  await db.put('cycles', {
    ...latestCycle,
    endDate: addDays(latestCycle.startDate, nextLength - 1),
  });
}

export async function getAllCycles(): Promise<CycleData[]> {
  const db = await getDB();
  return normalizeCycleTimeline(await db.getAllFromIndex('cycles', 'by-startDate'));
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
  return cycles.find((cycle) => {
    if (cycle.startDate === date) return true;
    if (cycle.endDate === date) return true;
    if (cycle.startDate <= date && cycle.endDate && cycle.endDate >= date) return true;
    return false;
  });
}

export async function addOrUpdateDailyLog(
  log: Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const db = await getDB();
  const existing = await db.getFromIndex('dailyLogs', 'by-date', log.date);
  const now = new Date().toISOString();
  const cleanedLog: Omit<DailyLog, 'id' | 'createdAt' | 'updatedAt'> = {
    ...log,
    flowIntensity: normalizeFlowIntensity(log.flowIntensity),
    painLevel: normalizePainLevel(log.painLevel),
    notes: log.notes?.trim() || undefined,
    symptoms: log.symptoms?.length ? log.symptoms : undefined,
  };

  if (!hasDailyLogContent(cleanedLog)) {
    if (existing?.id) {
      await db.delete('dailyLogs', existing.id);
    }
    return existing?.id || 0;
  }

  if (existing) {
    await db.put('dailyLogs', {
      ...existing,
      ...cleanedLog,
      updatedAt: now,
    });
    return existing.id!;
  }

  return db.add('dailyLogs', {
    ...cleanedLog,
    createdAt: now,
    updatedAt: now,
  });
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
  return allLogs.filter((log) => log.date >= startDate && log.date <= endDate);
}

export interface BackupData {
  version: number;
  exportDate: string;
  settings: Settings;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
}

type LegacyDailyLog = DailyLog & { isPeriod?: boolean };
type ImportableBackupData = Partial<BackupData> & {
  settings?: Partial<Settings>;
  cycles?: CycleData[];
  dailyLogs?: LegacyDailyLog[];
};

function isISODateString(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function deriveCyclesFromLegacyPeriodLogs(logs: LegacyDailyLog[]): CycleData[] {
  const periodDates = [...new Set(logs.filter((log) => log.isPeriod && isISODateString(log.date)).map((log) => log.date))]
    .sort((a, b) => daysBetween(a, b));

  if (periodDates.length === 0) return [];

  const cycles: CycleData[] = [];
  let startDate = periodDates[0];
  let previousDate = periodDates[0];

  for (const date of periodDates.slice(1)) {
    if (daysBetween(previousDate, date) === 1) {
      previousDate = date;
      continue;
    }

    cycles.push({ startDate, endDate: previousDate });
    startDate = date;
    previousDate = date;
  }

  cycles.push({ startDate, endDate: previousDate });
  return cycles;
}

function normalizeImportedCycles(cycles: CycleData[]): CycleData[] {
  const byStartDate = new Map<string, CycleData>();

  cycles.forEach((cycle) => {
    if (!isISODateString(cycle.startDate) || !isValidDateRange(cycle.startDate, cycle.endDate)) return;

    const existing = byStartDate.get(cycle.startDate);
    if (!existing) {
      byStartDate.set(cycle.startDate, {
        startDate: cycle.startDate,
        endDate: cycle.endDate,
        createdAt: cycle.createdAt || new Date().toISOString(),
      });
      return;
    }

    byStartDate.set(cycle.startDate, {
      ...existing,
      endDate: [existing.endDate, cycle.endDate].filter(Boolean).sort().at(-1),
      createdAt: existing.createdAt || cycle.createdAt || new Date().toISOString(),
    });
  });

  return normalizeCycleTimeline([...byStartDate.values()]);
}

export async function exportData(): Promise<BackupData> {
  const [settings, cycles, dailyLogs] = await Promise.all([
    getSettings(),
    getAllCycles(),
    getAllDailyLogs(),
  ]);

  const normalizedCycles = cycles.map(({ id, startDate, endDate, createdAt }) => ({
    id,
    startDate,
    endDate,
    createdAt: createdAt || new Date().toISOString(),
  }));

  const normalizedLogs = dailyLogs.map(
    ({ id, date, flowIntensity, flowColor, painLevel, symptoms, mood, notes, createdAt, updatedAt }) => ({
      id,
      date,
      ...(normalizeFlowIntensity(flowIntensity) && { flowIntensity: normalizeFlowIntensity(flowIntensity) }),
      ...(flowColor && { flowColor }),
      ...(normalizePainLevel(painLevel) && { painLevel: normalizePainLevel(painLevel) }),
      ...(symptoms && symptoms.length > 0 && { symptoms }),
      ...(mood && { mood }),
      ...(notes && { notes }),
      createdAt,
      updatedAt,
    })
  );

  return {
    version: 4,
    exportDate: new Date().toISOString(),
    settings,
    cycles: normalizedCycles,
    dailyLogs: normalizedLogs,
  };
}

export async function importData(data: BackupData): Promise<void> {
  const db = await getDB();
  const importData = data as ImportableBackupData;
  const importedLogs = Array.isArray(importData.dailyLogs) ? importData.dailyLogs : [];
  const importedCycles = normalizeImportedCycles([
    ...(Array.isArray(importData.cycles) ? importData.cycles : []),
    ...deriveCyclesFromLegacyPeriodLogs(importedLogs),
  ]);

  if (!importData.settings && importedCycles.length === 0 && importedLogs.length === 0) {
    throw new Error('Backup file does not contain importable data.');
  }

  await db.clear('cycles');
  await db.clear('dailyLogs');

  for (const cycle of importedCycles) {
    await db.add('cycles', {
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      createdAt: cycle.createdAt || new Date().toISOString(),
    });
  }

  for (const log of importedLogs) {
    if (!isISODateString(log.date)) continue;

    const { isPeriod, ...logWithoutIsPeriod } = log;
    const flowIntensity = normalizeFlowIntensity(logWithoutIsPeriod.flowIntensity);
    const painLevel = normalizePainLevel(logWithoutIsPeriod.painLevel);
    const cleanLog: DailyLog = {
      date: logWithoutIsPeriod.date,
      ...(flowIntensity && { flowIntensity }),
      ...(logWithoutIsPeriod.flowColor && { flowColor: logWithoutIsPeriod.flowColor }),
      ...(painLevel && { painLevel }),
      ...(logWithoutIsPeriod.symptoms?.length && { symptoms: logWithoutIsPeriod.symptoms }),
      ...(logWithoutIsPeriod.mood && { mood: logWithoutIsPeriod.mood }),
      ...(logWithoutIsPeriod.notes && { notes: logWithoutIsPeriod.notes }),
      createdAt: logWithoutIsPeriod.createdAt || new Date().toISOString(),
      updatedAt: logWithoutIsPeriod.updatedAt || new Date().toISOString(),
    };
    void isPeriod;

    if (hasDailyLogContent(cleanLog)) {
      await db.add('dailyLogs', cleanLog);
    }
  }

  const currentSettings = await getSettings();

  if (importData.settings) {
    const { lastBackupDate, ...settingsWithoutBackup } = importData.settings;
    void lastBackupDate;
    await updateSettings({
      ...settingsWithoutBackup,
      id: 1,
      persistentStorageGranted: currentSettings.persistentStorageGranted,
      lastBackupDate: undefined,
    });
  } else if (importedCycles.length > 0) {
    const sortedCycles = [...importedCycles].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const latestCycle = sortedCycles[0];

    let avgCycleLength = 28;
    if (sortedCycles.length >= 2) {
      const lengths: number[] = [];
      for (let i = 0; i < sortedCycles.length - 1; i++) {
        const diff = Math.floor(
          (new Date(sortedCycles[i].startDate).getTime() -
            new Date(sortedCycles[i + 1].startDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diff > 0 && diff < 60) lengths.push(diff);
      }
      if (lengths.length > 0) {
        avgCycleLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      }
    }

    let avgPeriodLength = 5;
    const periodLengths = importedCycles
      .filter((cycle) => cycle.startDate && cycle.endDate)
      .map((cycle) => {
        const start = new Date(cycle.startDate);
        const end = new Date(cycle.endDate!);
        return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      })
      .filter((length) => length > 0 && length < 15);

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

export async function syncLastPeriodStart(): Promise<void> {
  const cycles = await getAllCycles();
  if (cycles.length === 0) return;

  const sorted = [...cycles].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
  );
  const latestCycle = sorted[0];
  const currentSettings = await getSettings();

  if (currentSettings.lastPeriodStart !== latestCycle.startDate) {
    await updateSettings({ lastPeriodStart: latestCycle.startDate });
  }
}
