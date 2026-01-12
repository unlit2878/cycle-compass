import { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useCycleData } from "@/hooks/useCycleData";
import { Onboarding } from "@/components/Onboarding";
import { Home } from "@/components/Home";
import { CalendarPage } from "@/components/CalendarPage";
import { LoggingScreen } from "@/components/LoggingScreen";
import { InsightsPage } from "@/components/InsightsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { BottomNav } from "@/components/BottomNav";
import { formatDate } from "@/lib/cycle-utils";
import { BackupData, addCycle, updateCycle, getAllCycles } from "@/lib/db";
import { toast } from "sonner";
import { zh } from "@/lib/i18n";
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { initializeNotifications } from '@/lib/notifications';

const queryClient = new QueryClient();

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastBackPressRef = useRef<number>(0);
  const {
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
    refresh,
  } = useCycleData();

  const [loggingDate, setLoggingDate] = useState<string | null>(null);
  const [loggingExistingLog, setLoggingExistingLog] = useState<any>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Android 返回键处理
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const handleBackButton = () => {
      // 如果在记录页面，关闭记录
      if (loggingDate) {
        setLoggingDate(null);
        setLoggingExistingLog(null);
        return;
      }
      
      // 如果不在首页，返回首页
      if (location.pathname !== '/') {
        navigate('/');
        return;
      }
      
      // 在首页，双击退出
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        CapacitorApp.exitApp();
      } else {
        lastBackPressRef.current = now;
        toast('再按一次返回键退出应用');
      }
    };
    
    CapacitorApp.addListener('backButton', handleBackButton);
    
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, [location.pathname, loggingDate, navigate]);

  // 加载时应用深色模式
  useEffect(() => {
    if (settings?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.darkMode]);

  // 首次加载时请求持久存储并初始化通知
  useEffect(() => {
    if (settings && !settings.persistentStorageGranted) {
      requestPersistence();
    }
    
    // 初始化通知系统
    if (settings && Capacitor.isNativePlatform()) {
      initializeNotifications({
        reminderPeriodApproaching: settings.reminderPeriodApproaching,
        reminderOvulation: settings.reminderOvulation,
        reminderDailyLog: settings.reminderDailyLog,
        reminderPeriodDays: settings.reminderPeriodDays,
        lastPeriodStart: settings.lastPeriodStart,
        averageCycleLength: settings.averageCycleLength,
      });
    }
  }, [settings?.persistentStorageGranted, settings?.reminderPeriodApproaching, settings?.reminderOvulation, settings?.reminderDailyLog]);

  // 判断当前是否在经期中（改用 cycles 表判断）
  const isInPeriod = useMemo(() => {
    if (!cycles || cycles.length === 0) return false;
    
    const today = formatDate(new Date());
    const todayTime = new Date(today + 'T12:00:00').getTime();
    
    // 找到最新的周期记录
    const sortedCycles = [...cycles].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    
    const latestCycle = sortedCycles[0];
    if (!latestCycle) return false;
    
    const startTime = new Date(latestCycle.startDate + 'T12:00:00').getTime();
    const endTime = latestCycle.endDate 
      ? new Date(latestCycle.endDate + 'T12:00:00').getTime() 
      : startTime + 7 * 24 * 60 * 60 * 1000; // 如果没有结束日期，默认7天
    
    // 检查今天是否在最新周期的经期范围内
    return todayTime >= startTime && todayTime <= endTime;
  }, [cycles]);

  const handleLogToday = async () => {
    const today = formatDate(new Date());
    const existing = await getLogForDate(today);
    setLoggingExistingLog(existing);
    setLoggingDate(today);
  };

  const handleDaySelect = async (date: string) => {
    const existing = await getLogForDate(date);
    setLoggingExistingLog(existing);
    setLoggingDate(date);
  };

  const handleLogSave = async (data: any) => {
    if (loggingDate) {
      await logDay(loggingDate, data);
      toast.success('记录已保存！');
      setLoggingDate(null);
      setLoggingExistingLog(null);
    }
  };

  // 标记经期开始：只创建周期记录，不再创建冗余的 dailyLogs
  const handleStartPeriod = async (date: string, autoFillDays: number) => {
    const startDate = new Date(date + 'T12:00:00');
    
    // 更新设置中的最后经期开始日期
    await saveSettings({ lastPeriodStart: date });
    
    // 创建新的周期记录（不再存储 cycleLength，不再创建 dailyLogs）
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + autoFillDays - 1);
    await addCycle({
      startDate: date,
      endDate: formatDate(endDate),
    });
    
    toast.success(`已标记经期：${date} 至 ${formatDate(endDate)}`);
    await refresh();
    setLoggingDate(null);
    setLoggingExistingLog(null);
  };

  // 标记经期结束：只更新周期记录的结束日期
  const handleEndPeriod = async (date: string) => {
    // 更新最近周期的结束日期
    const allCycles = await getAllCycles();
    if (allCycles.length > 0) {
      const sortedCycles = [...allCycles].sort((a, b) => 
        new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
      const latestCycle = sortedCycles[0];
      if (latestCycle.id) {
        await updateCycle(latestCycle.id, { endDate: date });
      }
    }
    
    toast.success('已标记经期结束');
    await refresh();
    setLoggingDate(null);
    setLoggingExistingLog(null);
  };

  const handleImportFromOnboarding = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      await restore(data);
      toast.success('数据导入成功！');
    } catch {
      toast.error('导入数据失败');
    }
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-soft">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full gradient-primary mx-auto mb-4 animate-pulse-soft" />
          <p className="text-muted-foreground">{zh.common.loading}</p>
        </div>
      </div>
    );
  }

  // 如果未完成引导则显示引导页面
  if (!settings?.onboardingComplete) {
    return (
      <>
        <Onboarding onComplete={completeOnboarding} onImport={handleImportFromOnboarding} />
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileImport} className="hidden" />
      </>
    );
  }

  // 如果正在记录则显示记录页面
  if (loggingDate) {
    return (
      <LoggingScreen
        date={loggingDate}
        existingLog={loggingExistingLog}
        settings={settings}
        isInPeriod={isInPeriod}
        onSave={handleLogSave}
        onStartPeriod={handleStartPeriod}
        onEndPeriod={handleEndPeriod}
        onBack={() => { setLoggingDate(null); setLoggingExistingLog(null); }}
        onRefresh={refresh}
        onDeleteLog={deleteLog}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={
          <Home phaseInfo={phaseInfo} settings={settings} cycles={cycles} onDaySelect={handleDaySelect} onBackupReminder={() => navigate('/settings')} />
        } />
        <Route path="/calendar" element={
          <CalendarPage 
            settings={settings} 
            dailyLogs={dailyLogs} 
            cycles={cycles} 
            currentMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            onDaySelect={handleDaySelect} 
          />
        } />
        <Route path="/insights" element={
          <InsightsPage settings={settings} cycles={cycles} dailyLogs={dailyLogs} statistics={statistics} />
        } />
        <Route path="/settings" element={
          <SettingsPage settings={settings} onUpdateSettings={saveSettings} onExport={backup} onImport={restore} onRequestPersistence={requestPersistence} />
        } />
      </Routes>
      <BottomNav onLogClick={handleLogToday} />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
