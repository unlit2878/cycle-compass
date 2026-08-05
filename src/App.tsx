import { MouseEvent, TouchEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { toast } from 'sonner';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BottomNav } from '@/components/BottomNav';
import { CalendarPage } from '@/components/CalendarPage';
import { DataImportPage } from '@/components/DataImportPage';
import { Home } from '@/components/Home';
import { InsightsPage } from '@/components/InsightsPage';
import { InterfaceSettingsPage } from '@/components/InterfaceSettingsPage';
import { LoggingScreen } from '@/components/LoggingScreen';
import { Onboarding } from '@/components/Onboarding';
import { SettingsPage } from '@/components/SettingsPage';
import { useCycleData } from '@/hooks/useCycleData';
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference';
import { DailyLog, deleteCycle, getAllCycles, savePeriodStart, updateCycle } from '@/lib/db';
import { findPeriodCycleToEndOnDate, formatDate } from '@/lib/cycle-utils';

const queryClient = new QueryClient();
type LogPayload = Omit<DailyLog, 'id' | 'date' | 'createdAt' | 'updatedAt'>;
type MainRouteId = 'home' | 'calendar' | 'insights' | 'settings';
type RouteSlideDirection = 'left' | 'right' | null;
type LoggingAnimationState = 'closed' | 'opening' | 'open' | 'closing';

const MAIN_ROUTES: Array<{ id: MainRouteId; path: string }> = [
  { id: 'home', path: '/' },
  { id: 'calendar', path: '/calendar' },
  { id: 'insights', path: '/insights' },
  { id: 'settings', path: '/settings' },
];

const SWIPE_THRESHOLD_X = 72;
const SWIPE_MAX_VERTICAL_DRIFT = 70;

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotionPreference();
  const lastBackPressRef = useRef<number>(0);
  const swipeStartRef = useRef({ x: 0, y: 0 });
  const swipeLatestRef = useRef({ x: 0, y: 0 });
  const pendingLoggingNavigationRef = useRef<string | null>(null);
  const [loggingDate, setLoggingDate] = useState<string | null>(null);
  const [loggingExistingLog, setLoggingExistingLog] = useState<DailyLog | undefined>(undefined);
  const [loggingDirty, setLoggingDirty] = useState(false);
  const [loggingCloseRequestId, setLoggingCloseRequestId] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [routeSlideDirection, setRouteSlideDirection] = useState<RouteSlideDirection>(null);
  const [loggingAnimationState, setLoggingAnimationState] = useState<LoggingAnimationState>('closed');

  const {
    settings,
    cycles,
    dailyLogs,
    loading,
    cycleModel,
    backupStatus,
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

  const finishCloseLogging = useCallback(() => {
    setLoggingDate(null);
    setLoggingExistingLog(undefined);
    setLoggingDirty(false);
    setLoggingAnimationState('closed');
    const nextPath = pendingLoggingNavigationRef.current;
    pendingLoggingNavigationRef.current = null;
    if (nextPath) {
      navigate(nextPath);
    }
  }, [navigate]);

  const closeLogging = useCallback(() => {
    if (!loggingDate || loggingAnimationState === 'closing') return;
    if (reducedMotion) {
      finishCloseLogging();
      return;
    }
    setLoggingAnimationState('closing');
  }, [finishCloseLogging, loggingAnimationState, loggingDate, reducedMotion]);

  const requestCloseLogging = useCallback((to?: string, event?: MouseEvent<HTMLAnchorElement>) => {
    if (loggingDirty) {
      event?.preventDefault();
      pendingLoggingNavigationRef.current = to || null;
      setLoggingCloseRequestId((current) => current + 1);
      return;
    }

    if (loggingDate) {
      event?.preventDefault();
      pendingLoggingNavigationRef.current = to || null;
      closeLogging();
      return;
    }

  }, [closeLogging, loggingDate, loggingDirty]);

  const clearPendingLoggingNavigation = useCallback(() => {
    pendingLoggingNavigationRef.current = null;
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeBackButtonListener: (() => void) | undefined;
    let active = true;

    const handleBackButton = () => {
      if (loggingDate) {
        requestCloseLogging();
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
  }, [location.pathname, loggingDate, navigate, requestCloseLogging]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', Boolean(settings?.darkMode));
  }, [settings?.darkMode]);

  useEffect(() => {
    const updateMotionPlayback = () => {
      document.documentElement.classList.toggle('motion-paused', document.hidden);
    };
    updateMotionPlayback();
    document.addEventListener('visibilitychange', updateMotionPlayback);
    return () => {
      document.removeEventListener('visibilitychange', updateMotionPlayback);
      document.documentElement.classList.remove('motion-paused');
    };
  }, []);

  useEffect(() => {
    if (settings && !settings.persistentStorageGranted) {
      requestPersistence();
    }

  }, [settings, requestPersistence]);

  const openLogging = async (date: string) => {
    const existing = await getLogForDate(date);
    setLoggingExistingLog(existing);
    setLoggingDirty(false);
    pendingLoggingNavigationRef.current = null;
    setLoggingDate(date);
    setLoggingAnimationState(reducedMotion ? 'open' : 'opening');
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

  const handleDeletePeriod = async (cycleId: number) => {
    await deleteCycle(cycleId);
    await refresh();
    toast.success('经期记录已删除');
  };

  const handleImportFromOnboarding = () => {
    navigate('/settings/import');
  };

  const getCurrentMainRouteIndex = () => MAIN_ROUTES.findIndex((route) => route.path === location.pathname);

  const handleMainTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (shouldIgnoreRouteSwipe(event.target)) return;
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeLatestRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMainTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (shouldIgnoreRouteSwipe(event.target)) return;
    const touch = event.touches[0];
    swipeLatestRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMainTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (shouldIgnoreRouteSwipe(event.target)) return;

    const routeIndex = getCurrentMainRouteIndex();
    if (routeIndex < 0) return;

    const diffX = swipeStartRef.current.x - swipeLatestRef.current.x;
    const diffY = Math.abs(swipeStartRef.current.y - swipeLatestRef.current.y);
    if (Math.abs(diffX) < SWIPE_THRESHOLD_X || diffY > SWIPE_MAX_VERTICAL_DRIFT) return;

    const direction: RouteSlideDirection = diffX > 0 ? 'left' : 'right';
    const nextIndex = routeIndex + (direction === 'left' ? 1 : -1);
    const nextRoute = MAIN_ROUTES[nextIndex];
    if (!nextRoute) return;

    setRouteSlideDirection(direction);
    navigate(nextRoute.path);
  };

  if (loading) {
    return <div className="app-screen loading-screen" aria-label="应用启动中" />;
  }

  if (!settings?.onboardingComplete) {
    if (location.pathname === '/settings/import') {
      return <DataImportPage onImport={restore} />;
    }

    return <Onboarding onComplete={completeOnboarding} onImport={handleImportFromOnboarding} />;
  }

  return (
    <>
      <div
        key={location.pathname}
        className={`route-swipe-shell ${getRouteSlideClass(routeSlideDirection)}`}
        data-logging-covered={Boolean(loggingDate)}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setRouteSlideDirection(null);
        }}
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
      >
          <Routes location={location}>
            <Route
              path="/"
              element={
                <Home
                  settings={settings}
                  backupStatus={backupStatus}
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
                  backupStatus={backupStatus}
                  onUpdateSettings={saveSettings}
                  onExport={backup}
                />
              }
            />
            <Route
              path="/settings/import"
              element={<DataImportPage onImport={restore} />}
            />
            <Route
              path="/settings/interface"
              element={
                <InterfaceSettingsPage
                  settings={settings}
                  onUpdateSettings={saveSettings}
                />
              }
            />
          </Routes>
      </div>
      {loggingDate && (
        <div
          className="logging-layer"
          data-animation-state={loggingAnimationState}
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            if (loggingAnimationState === 'opening') setLoggingAnimationState('open');
            if (loggingAnimationState === 'closing') finishCloseLogging();
          }}
        >
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
            onDeletePeriod={handleDeletePeriod}
            onBack={closeLogging}
            onDirtyChange={setLoggingDirty}
            closeRequestSignal={loggingCloseRequestId}
            onKeepEditing={clearPendingLoggingNavigation}
            onRefresh={handleLoggingRefresh}
            onDeleteLog={deleteLog}
          />
        </div>
      )}
      <BottomNav
        onLogClick={loggingDate ? () => requestCloseLogging() : handleLogToday}
        onNavigate={requestCloseLogging}
        active={loggingDate ? 'log' : undefined}
      />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="bottom-center" />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

function shouldIgnoreRouteSwipe(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(
    'button, a, input, textarea, select, [role="button"], [data-route-swipe-ignore], .calendar-grid-wrap'
  ));
}

function getRouteSlideClass(direction: RouteSlideDirection) {
  if (direction === 'left') return 'route-slide-left';
  if (direction === 'right') return 'route-slide-right';
  return '';
}
