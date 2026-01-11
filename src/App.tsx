import { useState, useEffect, useRef, useMemo } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
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

const queryClient = new QueryClient();

function AppContent() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    backup,
    restore,
    requestPersistence,
    refresh,
  } = useCycleData();

  const [loggingDate, setLoggingDate] = useState<string | null>(null);
  const [loggingExistingLog, setLoggingExistingLog] = useState<any>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // 加载时应用深色模式
  useEffect(() => {
    if (settings?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.darkMode]);

  // 首次加载时请求持久存储
  useEffect(() => {
    if (settings && !settings.persistentStorageGranted) {
      requestPersistence();
    }
  }, [settings?.persistentStorageGranted]);

  // 判断当前是否在经期中
  const isInPeriod = useMemo(() => {
    if (!dailyLogs || dailyLogs.length === 0) return false;
    
    const today = formatDate(new Date());
    const todayTime = new Date(today + 'T12:00:00').getTime();
    
    // 检查最近14天内是否有经期记录且还没有结束
    // 找到最近的经期开始日期
    const periodLogs = dailyLogs.filter(log => log.isPeriod).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    if (periodLogs.length === 0) return false;
    
    // 检查最新的经期记录是否是连续的到今天
    const latestPeriodDate = new Date(periodLogs[0].date + 'T12:00:00');
    const daysDiff = Math.floor((todayTime - latestPeriodDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // 如果最近的经期记录在7天内，认为仍在经期中
    return daysDiff <= 7 && daysDiff >= 0;
  }, [dailyLogs]);

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

  // 标记经期开始：自动填充未来n天
  const handleStartPeriod = async (date: string, autoFillDays: number) => {
    const startDate = new Date(date + 'T12:00:00');
    
    // 更新设置中的最后经期开始日期
    await saveSettings({ lastPeriodStart: date });
    
    // 创建新的周期记录
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + autoFillDays - 1);
    await addCycle({
      startDate: date,
      endDate: formatDate(endDate),
      cycleLength: settings?.averageCycleLength || 28,
    });
    
    // 填充经期天数
    for (let i = 0; i < autoFillDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = formatDate(currentDate);
      
      await logDay(dateStr, {
        isPeriod: true,
        flowIntensity: i === 0 || i === autoFillDays - 1 ? 'light' : 'medium',
        symptoms: [],
      });
    }
    
    toast.success(`已标记经期开始，自动填充了${autoFillDays}天`);
    setLoggingDate(null);
    setLoggingExistingLog(null);
  };

  // 标记经期结束：清除当天之后的经期标记
  const handleEndPeriod = async (date: string) => {
    const endDate = new Date(date + 'T12:00:00');
    
    // 将当天之后（不包括当天）的经期记录清除
    for (const log of dailyLogs) {
      const logDate = new Date(log.date + 'T12:00:00');
      if (log.isPeriod && logDate > endDate) {
        await logDay(log.date, {
          ...log,
          isPeriod: false,
          flowIntensity: undefined,
        });
      }
    }
    
    // 确保当天是经期
    await logDay(date, {
      isPeriod: true,
      flowIntensity: 'light',
      symptoms: [],
    });
    
    // 更新最近周期的结束日期
    const allCycles = await getAllCycles();
    if (allCycles.length > 0) {
      const latestCycle = allCycles[allCycles.length - 1];
      if (latestCycle.id) {
        await updateCycle(latestCycle.id, { endDate: date });
      }
    }
    
    toast.success('已标记经期结束');
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
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
