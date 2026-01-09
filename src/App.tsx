import { useState, useEffect, useRef } from 'react';
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
import { BackupData } from "@/lib/db";
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
  } = useCycleData();

  const [loggingDate, setLoggingDate] = useState<string | null>(null);
  const [loggingExistingLog, setLoggingExistingLog] = useState<any>(null);

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
        onSave={handleLogSave}
        onBack={() => { setLoggingDate(null); setLoggingExistingLog(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={
          <Home phaseInfo={phaseInfo} settings={settings} onLogToday={handleLogToday} onBackupReminder={() => navigate('/settings')} />
        } />
        <Route path="/calendar" element={
          <CalendarPage settings={settings} dailyLogs={dailyLogs} onDaySelect={handleDaySelect} />
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
