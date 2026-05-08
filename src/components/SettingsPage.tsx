import { ReactNode, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Database,
  Download,
  Droplet,
  Leaf,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/AppScaffold';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BackupData, Settings as SettingsType } from '@/lib/db';
import { toast } from 'sonner';

interface SettingsPageProps {
  settings: SettingsType | null;
  onUpdateSettings: (updates: Partial<SettingsType>) => Promise<SettingsType>;
  onExport: () => Promise<BackupData>;
}

export function SettingsPage({
  settings,
  onUpdateSettings,
  onExport,
}: SettingsPageProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [cycleSettingsOpen, setCycleSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash !== '#data-management') return;
    requestAnimationFrame(() => {
      document.getElementById('data-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash]);

  const handleExport = async () => {
    setBusy('export');
    try {
      const data = await onExport();
      const fileName = `zhiqi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const json = JSON.stringify(data, null, 2);
      const location = Capacitor.isNativePlatform()
        ? await exportNativeBackup(fileName, json)
        : exportWebBackup(fileName, json);

      await onUpdateSettings({ lastBackupDate: new Date().toISOString() });
      toast.success(`数据已导出：${location}`);
    } catch {
      toast.error('导出失败，请稍后再试');
    } finally {
      setBusy(null);
    }
  };

  if (!settings) {
    return (
      <PageShell title="知期" subtitle="了解自己，掌握节奏，拥抱每一个阶段的你" decor="settings">
        <div className="empty-state">正在加载设置...</div>
      </PageShell>
    );
  }

  return (
    <PageShell title="知期" subtitle="了解自己，掌握节奏，拥抱每一个阶段的你" decor="settings" className="settings-screen">
      <SettingsGroup id="data-management" title="数据管理">
        <SettingsRow
          icon={Database}
          tone="green"
          title="备份状态"
          desc={formatBackupStatus(settings.lastBackupDate)}
        />
        <SettingsRow
          icon={Download}
          tone="green"
          title={busy === 'export' ? '导出中...' : '导出数据'}
          desc={Capacitor.isNativePlatform() ? '导出 JSON 备份到 Documents/Download' : '导出 JSON 备份文件'}
          onClick={handleExport}
        />
        <SettingsRow
          icon={Upload}
          tone="orange"
          title="导入数据"
          desc="选择 JSON 文件，或粘贴整理好的 JSON"
          onClick={() => navigate('/settings/import')}
        />
      </SettingsGroup>

      <SettingsGroup title="周期设置">
        <SettingsRow
          icon={Droplet}
          tone="pink"
          title="周期设置"
          desc={`周期 ${settings.averageCycleLength} 天，经期 ${settings.averagePeriodLength} 天`}
          onClick={() => setCycleSettingsOpen(true)}
        />
        <CycleSettingsDialog
          open={cycleSettingsOpen}
          onOpenChange={setCycleSettingsOpen}
          settings={settings}
          onSave={async (updates) => {
            await onUpdateSettings(updates);
            toast.success('周期设置已保存');
          }}
        />
      </SettingsGroup>

      <footer className="settings-footer">
        <Leaf className="h-10 w-10" />
        <p>愿你在每一个阶段，都被温柔以待</p>
        <span>v {__APP_VERSION__}</span>
      </footer>
    </PageShell>
  );
}

function exportWebBackup(fileName: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return `浏览器下载：${fileName}`;
}

async function exportNativeBackup(fileName: string, json: string) {
  const path = `Download/${fileName}`;
  await Filesystem.requestPermissions();
  const result = await Filesystem.writeFile({
    path,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  return result.uri || `Documents/${path}`;
}

function formatBackupStatus(lastBackupDate?: string) {
  if (!lastBackupDate) return '从未备份';

  const now = new Date();
  const lastBackup = new Date(lastBackupDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const backupDay = new Date(lastBackup.getFullYear(), lastBackup.getMonth(), lastBackup.getDate());
  const diffDays = Math.max(0, Math.floor((today.getTime() - backupDay.getTime()) / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return '今天已备份';
  return `${diffDays} 天前已备份`;
}

function SettingsGroup({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="settings-group">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function CycleSettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SettingsType;
  onSave: (updates: Pick<SettingsType, 'averageCycleLength' | 'averagePeriodLength'>) => Promise<void>;
}) {
  const [cycleLength, setCycleLength] = useState(settings.averageCycleLength);
  const [periodLength, setPeriodLength] = useState(settings.averagePeriodLength);

  useEffect(() => {
    if (!open) return;
    setCycleLength(settings.averageCycleLength);
    setPeriodLength(settings.averagePeriodLength);
  }, [open, settings.averageCycleLength, settings.averagePeriodLength]);

  const handleSave = async () => {
    await onSave({
      averageCycleLength: clampWholeNumber(cycleLength, 18, 60),
      averagePeriodLength: clampWholeNumber(periodLength, 1, 14),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="import-help-dialog">
        <DialogHeader>
          <DialogTitle>周期设置</DialogTitle>
          <DialogDescription>没有足够历史记录时，会使用这里的周期和经期长度进行预测。</DialogDescription>
        </DialogHeader>
        <div className="cycle-settings-form">
          <label>
            <span>平均周期长度</span>
            <input
              type="number"
              min={18}
              max={60}
              value={cycleLength}
              onChange={(event) => setCycleLength(Number(event.target.value))}
            />
            <small>18-60 天</small>
          </label>
          <label>
            <span>平均经期长度</span>
            <input
              type="number"
              min={1}
              max={14}
              value={periodLength}
              onChange={(event) => setPeriodLength(Number(event.target.value))}
            />
            <small>1-14 天</small>
          </label>
          <button type="button" className="dialog-primary-action" onClick={handleSave}>
            保存设置
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function clampWholeNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function SettingsRow({
  icon: Icon,
  tone,
  title,
  desc,
  onClick,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  desc: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`settings-row-icon ${tone}`}>
        <Icon className="h-8 w-8" />
      </span>
      <span className="settings-row-copy">
        <strong>{title}</strong>
        <small>{desc}</small>
      </span>
      <ChevronRight className="settings-chevron" />
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="settings-row" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="settings-row">{content}</div>;
}
