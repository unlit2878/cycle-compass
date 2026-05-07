import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BottomNav } from '@/components/BottomNav';
import { CalendarPage } from '@/components/CalendarPage';
import { Home } from '@/components/Home';
import { InsightsPage } from '@/components/InsightsPage';
import { LoggingScreen } from '@/components/LoggingScreen';
import { Onboarding } from '@/components/Onboarding';
import { SettingsPage } from '@/components/SettingsPage';
import { useCycleData } from '@/hooks/useCycleData';
import { BackupData, DailyLog, getAllCycles, savePeriodStart, updateCycle } from '@/lib/db';
import { findPeriodCycleToEndOnDate, formatDate } from '@/lib/cycle-utils';
import { initializeNotifications } from '@/lib/notifications';

const queryClient = new QueryClient();
type LogPayload = Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastBackPressRef = useRef<number>(0);
  const [loggingDate, setLoggingDate] = useState<string | null>(null);
  const [loggingExistingLog, setLoggingExistingLog] = useState<DailyLog | undefined>(undefined);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const {
    settings,
    cycles,
    dailyLogs,
    loading,
    cycleModel,
    statistics,
    saveSettings,
    completeOnboarding,
    logDay,
    getLogForDate,
    deleteLog,
    backup,
    restore,
    requestPersistence,
    refresh,
  } = useCycleData();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeBackButtonListener: (() => void) | undefined;
    let active = true;

    const handleBackButton = () => {
      if (loggingDate) {
        setLoggingDate(null);
        setLoggingExistingLog(undefined);
        return;
      }

      if (location.pathname !== '/') {
        navigate('/');
        return;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPressRef.current = now;
        toast('再按一次返回键退出应用');
      }
    };

    CapacitorApp.addListener('backButton', handleBackButton).then((listener) => {
      removeBackButtonListener = () => listener.remove();
      if (!active) removeBackButtonListener();
    });

    return () => {
      active = false;
      removeBackButtonListener?.();
    };
  }, [location.pathname, loggingDate, navigate]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', Boolean(settings?.darkMode));
  }, [settings?.darkMode]);

  useEffect(() => {
    if (settings && !settings.persistentStorageGranted) {
      requestPersistence();
    }

    if (settings && Capacitor.isNativePlatform()) {
      initializeNotifications({
        reminderPeriodApproaching: settings.reminderPeriodApproaching,
        reminderOvulation: settings.reminderOvulation,
        reminderDailyLog: settings.reminderDailyLog,
        reminderPeriodDays: settings.reminderPeriodDays,
        lastPeriodStart: settings.lastPeriodStart,
        averageCycleLength: cycleModel?.effectiveCycleLength || settings.averageCycleLength,
      });
    }
  }, [
    settings,
    cycleModel?.effectiveCycleLength,
    requestPersistence,
  ]);

  const closeLogging = () => {
    setLoggingDate(null);
    setLoggingExistingLog(undefined);
  };

  const openLogging = async (date: string) => {
    const existing = await getLogForDate(date);
    setLoggingExistingLog(existing);
    setLoggingDate(date);
  };

  const handleLogToday = () => openLogging(formatDate(new Date()));

  const handleLoggingRefresh = async () => {
    await refresh();
    if (loggingDate) {
      setLoggingExistingLog(await getLogForDate(loggingDate));
    }
  };

  const handleLogSave = async (targetDate: string, data: LogPayload, originalDate: string) => {
    if (!loggingDate) return;
    if (targetDate !== originalDate && loggingExistingLog) {
      await deleteLog(originalDate);
    }
    await logDay(targetDate, data);
    toast.success('记录已保存');
    closeLogging();
  };

  const handleMoodSelect = async (date: string, mood: string | undefined) => {
    const existing = await getLogForDate(date);
    await logDay(date, {
      flowIntensity: existing?.flowIntensity,
      flowColor: existing?.flowColor,
      painLevel: existing?.painLevel,
      symptoms: existing?.symptoms,
      mood,
      notes: existing?.notes,
    });
    toast.success(mood ? `心情已记录：${mood}` : '已取消心情记录');
  };

  const handleStartPeriod = async (date: string, autoFillDays: number, cycleId?: number) => {
    const startDate = new Date(`${date}T12:00:00`);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + autoFillDays - 1);

    await savePeriodStart(date, formatDate(endDate), cycleId);

    await refresh();
  };

  const handleEndPeriod = async (date: string, cycleId?: number) => {
    const allCycles = await getAllCycles();
    const cycle = cycleId ? allCycles.find((item) => item.id === cycleId) : findPeriodCycleToEndOnDate(date, allCycles);

    if (!cycle?.id) {
      toast.error('请先标记这一段经期的开始日期');
      return;
    }

    try {
      await updateCycle(cycle.id, { endDate: date });
      await refresh();
    } catch {
      toast.error('经期结束日期不能早于开始日期');
    }
  };

  const handleImportFromOnboarding = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await restore(JSON.parse(text) as BackupData);
      toast.success('数据导入成功');
    } catch {
      toast.error('导入数据失败');
    } finally {
      event.target.value = '';
    }
  };

  if (loading) {
    return <div className="app-screen loading-screen" aria-label="应用启动中" />;
  }

  if (!settings?.onboardingComplete) {
    return (
      <>
        <Onboarding onComplete={completeOnboarding} onImport={handleImportFromOnboarding} />
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
      </>
    );
  }

  return (
    <>
      {loggingDate ? (
        <LoggingScreen
          date={loggingDate}
          existingLog={loggingExistingLog}
          cycles={cycles}
          settings={settings}
          cycleModel={cycleModel}
          statistics={statistics}
          onSave={handleLogSave}
          onStartPeriod={handleStartPeriod}
          onEndPeriod={handleEndPeriod}
          onBack={closeLogging}
          onRefresh={handleLoggingRefresh}
          onDeleteLog={deleteLog}
        />
      ) : (
        <Routes>
          <Route
            path="/"
            element={
              <Home
                settings={settings}
                cycleModel={cycleModel}
                cycles={cycles}
                dailyLogs={dailyLogs}
                onDaySelect={openLogging}
                onMoodSelect={handleMoodSelect}
                onBackupReminder={() => navigate('/settings#data-management')}
              />
            }
          />
          <Route
            path="/calendar"
            element={
              <CalendarPage
                settings={settings}
                dailyLogs={dailyLogs}
                cycles={cycles}
                cycleModel={cycleModel}
                currentMonth={calendarMonth}
                onMonthChange={setCalendarMonth}
                onDaySelect={openLogging}
                onMoodSelect={handleMoodSelect}
              />
            }
          />
          <Route
            path="/insights"
            element={
              <InsightsPage
                settings={settings}
                cycles={cycles}
                dailyLogs={dailyLogs}
                statistics={statistics}
                cycleModel={cycleModel}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage
                settings={settings}
                onUpdateSettings={saveSettings}
                onExport={backup}
                onImport={restore}
              />
            }
          />
        </Routes>
      )}
      <BottomNav onLogClick={handleLogToday} onNavigate={closeLogging} active={loggingDate ? 'log' : undefined} />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="bottom-center" />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
