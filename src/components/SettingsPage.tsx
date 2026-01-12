import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Bell,
  Database,
  Moon,
  Sun,
  Download,
  Upload,
  Shield,
  Info,
  ChevronRight,
  Check,
  AlertCircle,
  HelpCircle,
  Smartphone,
} from 'lucide-react';
import { Settings as SettingsType, BackupData } from '@/lib/db';
import { getDaysSinceBackup } from '@/lib/cycle-utils';
import { zh } from '@/lib/i18n';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { toast } from 'sonner';
import { 
  requestNotificationPermission, 
  checkNotificationPermission, 
  cancelAllNotifications,
  scheduleDailyReminder,
  cancelDailyReminder,
  initializeNotifications
} from '@/lib/notifications';

interface SettingsPageProps {
  settings: SettingsType | null;
  onUpdateSettings: (updates: Partial<SettingsType>) => Promise<SettingsType>;
  onExport: () => Promise<BackupData>;
  onImport: (data: BackupData) => Promise<void>;
  onRequestPersistence: () => Promise<boolean>;
}

export function SettingsPage({
  settings,
  onUpdateSettings,
  onExport,
  onImport,
  onRequestPersistence,
}: SettingsPageProps) {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isNative = Capacitor.isNativePlatform();

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{zh.common.loading}</p>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const data = await onExport();
      const jsonString = JSON.stringify(data, null, 2);
      const fileName = `zhiqi-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      if (isNative) {
        // 原生平台：写入文档文件夹
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: jsonString,
            directory: Directory.Documents,
            encoding: Encoding.UTF8,
          });
          toast.success(`数据已导出到"文档"文件夹：${fileName}`);
          setExportSuccess(true);
          await onUpdateSettings({ lastBackupDate: new Date().toISOString() });
        } catch (fsError) {
          console.error('文件系统写入失败:', fsError);
          // 尝试使用外部存储
          try {
            await Filesystem.writeFile({
              path: `Download/${fileName}`,
              data: jsonString,
              directory: Directory.ExternalStorage,
              encoding: Encoding.UTF8,
            });
            toast.success(`数据已导出到"下载"文件夹：${fileName}`);
            setExportSuccess(true);
            await onUpdateSettings({ lastBackupDate: new Date().toISOString() });
          } catch (extError) {
            console.error('外部存储写入也失败:', extError);
            toast.error('导出失败，请检查存储权限。您可以在系统设置中授予应用存储权限。');
          }
        }
      } else {
        // Web 平台：使用下载链接
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        await onUpdateSettings({ lastBackupDate: new Date().toISOString() });
        setExportSuccess(true);
        toast.success('数据导出成功！');
      }
      
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportSuccess(false);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;
      await onImport(data);
      setImportSuccess(true);
      toast.success('数据导入成功！');
    } catch (error) {
      console.error('导入失败:', error);
      toast.error('导入失败，请检查文件格式');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleRequestPersistence = async () => {
    const granted = await onRequestPersistence();
    if (granted) {
      toast.success('持久化存储已启用！');
    } else {
      toast.error('无法启用持久化存储');
    }
  };

  // 处理经期提醒开关
  const handlePeriodReminderToggle = async (checked: boolean) => {
    if (checked && isNative) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        toast.error('请在系统设置中授予通知权限');
        return;
      }
      toast.success('经期提醒已开启');
    } else if (!checked) {
      await cancelAllNotifications();
    }
    onUpdateSettings({ reminderPeriodApproaching: checked });
  };

  // 处理排卵期提醒开关
  const handleOvulationReminderToggle = async (checked: boolean) => {
    if (checked && isNative) {
      const hasPermission = await checkNotificationPermission();
      if (!hasPermission) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          toast.error('请在系统设置中授予通知权限');
          return;
        }
      }
      toast.success('排卵期提醒已开启');
    }
    onUpdateSettings({ reminderOvulation: checked });
  };

  const daysSinceBackup = getDaysSinceBackup(settings.lastBackupDate);
  const backupStatusText =
    daysSinceBackup === Infinity
      ? '从未备份'
      : daysSinceBackup === 0
        ? '今天已备份'
        : `上次备份：${daysSinceBackup} 天前`;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">{zh.settings.title}</h1>

      {/* 提醒设置 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">通知提醒</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0 divide-y divide-border">
            {/* 经期临近提醒 */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">{zh.settings.periodReminder}</span>
                </div>
                <Switch
                  checked={settings.reminderPeriodApproaching}
                  onCheckedChange={handlePeriodReminderToggle}
                />
              </div>
              {settings.reminderPeriodApproaching && (
                <div className="ml-8 mt-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    提前 {settings.reminderPeriodDays} 天提醒
                  </p>
                  <Slider
                    value={[settings.reminderPeriodDays]}
                    onValueChange={(v) => onUpdateSettings({ reminderPeriodDays: v[0] })}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* 排卵期提醒 */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-phase-ovulation" />
                <span className="font-medium text-foreground">排卵期提醒</span>
              </div>
              <Switch
                checked={settings.reminderOvulation}
                onCheckedChange={handleOvulationReminderToggle}
              />
            </div>

            {/* 每日记录提醒 */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-phase-follicular" />
                <span className="font-medium text-foreground">{zh.settings.dailyReminder}</span>
              </div>
              <Switch
                checked={settings.reminderDailyLog}
                onCheckedChange={async (checked) => {
                  if (checked && isNative) {
                    const hasPermission = await checkNotificationPermission();
                    if (!hasPermission) {
                      const granted = await requestNotificationPermission();
                      if (!granted) {
                        toast.error('请在系统设置中授予通知权限');
                        return;
                      }
                    }
                    await scheduleDailyReminder();
                    toast.success('每日提醒已开启，将在每晚8点提醒您记录');
                  } else if (!checked && isNative) {
                    await cancelDailyReminder();
                  }
                  onUpdateSettings({ reminderDailyLog: checked });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 数据管理 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">{zh.settings.dataManagement}</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0 divide-y divide-border">
            {/* 备份状态 */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <Database className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">备份状态</span>
              </div>
              <p className="ml-8 text-sm text-muted-foreground flex items-center gap-2">
                {daysSinceBackup !== Infinity && daysSinceBackup <= 7 ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-warning" />
                )}
                {backupStatusText}
              </p>
            </div>

            {/* 导出数据 */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  {exporting ? '导出中...' : exportSuccess ? '导出成功！' : zh.settings.exportData}
                </span>
              </div>
              {exportSuccess ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {/* 导入数据 */}
            <div className="p-4 flex items-center justify-between">
              <button
                onClick={handleImportClick}
                disabled={importing}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
              >
                <Upload className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  {importing ? '导入中...' : importSuccess ? '导入成功！' : zh.settings.importData}
                </span>
              </button>
              <div className="flex items-center gap-2">
                {importSuccess ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="p-1.5 rounded-full hover:bg-muted transition-colors">
                        <HelpCircle className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>导入数据格式说明</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <p className="text-muted-foreground">
                          导入文件必须是JSON格式，包含以下结构：
                        </p>
                        <div className="bg-muted p-3 rounded-lg font-mono text-xs overflow-x-auto">
                          <pre>{`{
  "version": 1,
  "exportDate": "2026-01-09T12:00:00Z",
  "settings": {
    "id": 1,
    "onboardingComplete": true,
    "lastPeriodStart": "2025-12-28",
    "averageCycleLength": 28,
    "averagePeriodLength": 5,
    ...其他设置
  },
  "cycles": [
    {
      "id": 1767373323381,
      "startDate": "2025-11-28",
      "endDate": "2025-12-04",
      "cycleLength": 28
    }
  ],
  "dailyLogs": [
    {
      "id": 1,
      "date": "2025-12-28",
      "isPeriod": true,
      "flowIntensity": "medium",
      "symptoms": ["头痛", "疲劳"],
      "mood": "一般",
      "notes": "备注内容",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}`}</pre>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium">字段说明：</h4>
                          <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                            <li><code className="text-primary">cycles</code>：周期记录数组
                              <ul className="list-disc pl-4 mt-1">
                                <li><code>startDate</code>：经期开始日期（必需）</li>
                                <li><code>endDate</code>：经期结束日期（可选）</li>
                                <li><code>cycleLength</code>：周期长度（可选）</li>
                              </ul>
                            </li>
                            <li><code className="text-primary">dailyLogs</code>：每日记录数组
                              <ul className="list-disc pl-4 mt-1">
                                <li><code>date</code>：日期，格式YYYY-MM-DD</li>
                                <li><code>isPeriod</code>：是否经期</li>
                                <li><code>flowIntensity</code>：light/medium/heavy</li>
                                <li><code>symptoms</code>：症状数组</li>
                                <li><code>mood</code>：心情</li>
                              </ul>
                            </li>
                          </ul>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          💡 提示：最简单的方式是先导出现有数据，查看格式后再修改导入。
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* 备份提醒间隔 */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">{zh.settings.backupReminder}</span>
              </div>
              <div className="ml-8 flex gap-2">
                {(['weekly', 'monthly'] as const).map((interval) => (
                  <button
                    key={interval}
                    onClick={() => onUpdateSettings({ backupReminderInterval: interval })}
                    className={`px-4 py-2 rounded-xl text-sm transition-all ${
                      settings.backupReminderInterval === interval
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {interval === 'weekly' ? '每周' : '每月'}
                  </button>
                ))}
              </div>
            </div>

            {/* 持久存储 - 仅在 Web 平台显示 */}
            {!isNative && (
              <button
                onClick={handleRequestPersistence}
                disabled={settings.persistentStorageGranted}
                className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <span className="font-medium text-foreground block">{zh.settings.persistentStorage}</span>
                    <span className="text-xs text-muted-foreground">
                      {settings.persistentStorageGranted
                        ? '存储保护已启用'
                        : zh.settings.persistentStorageDesc}
                    </span>
                  </div>
                </div>
                {settings.persistentStorageGranted ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
            )}

            {/* 原生平台通知提示 */}
            {isNative && (
              <div className="p-4 flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-primary" />
                <span className="text-sm text-muted-foreground">
                  数据安全存储在本机，无需额外权限
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 显示设置 */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">{zh.settings.display}</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.darkMode ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
              <span className="font-medium text-foreground">{zh.settings.darkMode}</span>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(checked) => {
                onUpdateSettings({ darkMode: checked });
                if (checked) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* 关于 */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">{zh.settings.about}</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-primary" />
            <div>
              <span className="font-medium text-foreground block">{zh.appName}</span>
              <span className="text-sm text-muted-foreground">{zh.settings.version} 1.0.0</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
