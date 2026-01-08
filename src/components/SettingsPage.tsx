import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
} from 'lucide-react';
import { Settings as SettingsType, BackupData } from '@/lib/db';
import { getDaysSinceBackup } from '@/lib/cycle-utils';

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
  const [persistenceRequested, setPersistenceRequested] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      const data = await onExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mycycle-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
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
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import data. Please check the file format.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleRequestPersistence = async () => {
    const granted = await onRequestPersistence();
    setPersistenceRequested(true);
    if (!granted) {
      alert('Persistent storage was not granted. Your data may be cleared when storage is low.');
    }
  };

  const daysSinceBackup = getDaysSinceBackup(settings.lastBackupDate);
  const backupStatusText =
    daysSinceBackup === Infinity
      ? 'Never backed up'
      : daysSinceBackup === 0
        ? 'Backed up today'
        : `Last backup: ${daysSinceBackup} day${daysSinceBackup === 1 ? '' : 's'} ago`;

  return (
    <div className="min-h-screen pb-24 px-4 pt-6">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Reminders Section */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">REMINDERS</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0 divide-y divide-border">
            {/* Period Approaching */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-primary" />
                  <span className="font-medium text-foreground">Period Approaching</span>
                </div>
                <Switch
                  checked={settings.reminderPeriodApproaching}
                  onCheckedChange={(checked) =>
                    onUpdateSettings({ reminderPeriodApproaching: checked })
                  }
                />
              </div>
              {settings.reminderPeriodApproaching && (
                <div className="ml-8 mt-3">
                  <p className="text-sm text-muted-foreground mb-2">
                    Notify {settings.reminderPeriodDays} days before
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

            {/* Ovulation Reminder */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-phase-ovulation" />
                <span className="font-medium text-foreground">Ovulation Reminder</span>
              </div>
              <Switch
                checked={settings.reminderOvulation}
                onCheckedChange={(checked) => onUpdateSettings({ reminderOvulation: checked })}
              />
            </div>

            {/* Daily Log Reminder */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-phase-follicular" />
                <span className="font-medium text-foreground">Daily Log Reminder</span>
              </div>
              <Switch
                checked={settings.reminderDailyLog}
                onCheckedChange={(checked) => onUpdateSettings({ reminderDailyLog: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Management Section */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">DATA MANAGEMENT</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0 divide-y divide-border">
            {/* Backup Status */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-1">
                <Database className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">Backup Status</span>
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

            {/* Export Data */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  {exporting ? 'Exporting...' : exportSuccess ? 'Exported!' : 'Export Data'}
                </span>
              </div>
              {exportSuccess ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>

            {/* Import Data */}
            <button
              onClick={handleImportClick}
              disabled={importing}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">
                  {importing ? 'Importing...' : importSuccess ? 'Imported!' : 'Import Data'}
                </span>
              </div>
              {importSuccess ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Backup Reminder Interval */}
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="w-5 h-5 text-primary" />
                <span className="font-medium text-foreground">Backup Reminder</span>
              </div>
              <div className="ml-8 flex gap-2">
                {(['weekly', 'monthly'] as const).map((interval) => (
                  <button
                    key={interval}
                    onClick={() => onUpdateSettings({ backupReminderInterval: interval })}
                    className={`px-4 py-2 rounded-xl text-sm capitalize transition-all ${
                      settings.backupReminderInterval === interval
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {interval}
                  </button>
                ))}
              </div>
            </div>

            {/* Persistent Storage */}
            <button
              onClick={handleRequestPersistence}
              disabled={settings.persistentStorageGranted}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div className="text-left">
                  <span className="font-medium text-foreground block">Persistent Storage</span>
                  <span className="text-xs text-muted-foreground">
                    {settings.persistentStorageGranted
                      ? 'Storage protection enabled'
                      : 'Request browser to protect your data'}
                  </span>
                </div>
              </div>
              {settings.persistentStorageGranted ? (
                <Check className="w-5 h-5 text-success" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Display Section */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">DISPLAY</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {settings.darkMode ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
              <span className="font-medium text-foreground">Dark Mode</span>
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

      {/* About Section */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3 px-1">ABOUT</h2>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-primary" />
            <div>
              <span className="font-medium text-foreground block">MyCycle</span>
              <span className="text-sm text-muted-foreground">Version 1.0.0</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
