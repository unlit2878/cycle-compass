import type { IconComponent } from 'reicon-react/createIcon';
import { useState } from 'react';
import { ArrowLeft, Calendar, Check, Loader, Plus, AlertTriangle } from 'reicon-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/AppScaffold';
import { Switch } from '@/components/ui/switch';
import { CalendarPhaseStyle, Settings as SettingsType } from '@/lib/db';
import { canRequestWidgetPin, openWidgetPermissionSettings, requestWidgetPin, waitForWidgetPinOutcome, type WidgetSize } from '@/lib/widget-sync';
import { toast } from 'sonner';
import mediumWidgetPreview from '../../android/app/src/main/res/drawable-nodpi/widget_preview_small.png';
import largeWidgetPreview from '../../android/app/src/main/res/drawable-nodpi/widget_preview_large.png';

interface InterfaceSettingsPageProps {
  settings: SettingsType | null;
  onUpdateSettings: (updates: Partial<SettingsType>) => Promise<SettingsType>;
}

const calendarStyleOptions: Array<{
  value: CalendarPhaseStyle;
  title: string;
  desc: string;
  icon: IconComponent;
}> = [
  {
    value: 'classic',
    title: '样式一',
    desc: '阶段以柔和背景呈现，记录使用底部圆点标记',
    icon: Calendar,
  },
  {
    value: 'underline',
    title: '样式二',
    desc: '阶段以日期下方纹理线呈现，记录使用叶子标记',
    icon: Calendar,
  },
];

const widgetOptions: Array<{
  size: WidgetSize;
  title: string;
  footprint: string;
  desc: string;
  preview: string;
}> = [
  {
    size: 'medium',
    title: '中尺寸组件',
    footprint: '2 × 2',
    desc: '集中显示当前阶段、周期日和下次经期倒计时',
    preview: mediumWidgetPreview,
  },
  {
    size: 'large',
    title: '大尺寸组件',
    footprint: '4 × 2',
    desc: '在倒计时之外，增加近期周期长度对比',
    preview: largeWidgetPreview,
  },
];

export function InterfaceSettingsPage({ settings, onUpdateSettings }: InterfaceSettingsPageProps) {
  const navigate = useNavigate();
  const selectedStyle = settings?.calendarPhaseStyle || 'classic';
  const [savingStyle, setSavingStyle] = useState(false);
  const [installingWidget, setInstallingWidget] = useState<WidgetSize | null>(null);
  const [widgetOutcome, setWidgetOutcome] = useState<{ size: WidgetSize; status: 'success' | 'error' } | null>(null);
  const widgetPinAvailable = canRequestWidgetPin();

  const selectStyle = async (style: CalendarPhaseStyle) => {
    if (style === selectedStyle || savingStyle) return;
    setSavingStyle(true);
    try {
      await onUpdateSettings({ calendarPhaseStyle: style });
      toast.success(`日历样式已切换为${style === 'underline' ? '样式二' : '样式一'}`);
    } catch {
      toast.error('日历样式保存失败，请重试');
    } finally {
      setSavingStyle(false);
    }
  };

  const showWidgetOutcome = (size: WidgetSize, status: 'success' | 'error') => {
    setWidgetOutcome({ size, status });
    window.setTimeout(() => setWidgetOutcome((current) => current?.size === size ? null : current), 1200);
  };

  const installWidget = async (size: WidgetSize) => {
    setInstallingWidget(size);
    setWidgetOutcome(null);
    try {
      const result = await requestWidgetPin(size);
      if (!result.supported) {
        showWidgetOutcome(size, 'error');
        toast.error('当前系统桌面不支持应用内添加，请长按桌面手动添加');
        return;
      }
      if (!result.requested) {
        showWidgetOutcome(size, 'error');
        toast.error('未能打开添加确认，请稍后重试');
        return;
      }

      const outcome = await waitForWidgetPinOutcome(size, result.pinnedCount);
      if (outcome === 'added') {
        showWidgetOutcome(size, 'success');
        toast.success('小组件已添加到桌面');
      } else if (outcome === 'dismissed') {
        toast('已取消添加');
      } else {
        showWidgetOutcome(size, 'error');
        toast.error('系统未弹出确认框，请开启「桌面快捷方式」与「后台弹出界面」权限后重试', {
          duration: 10000,
          action: {
            label: '去开启',
            onClick: () => {
              void openWidgetPermissionSettings().then((opened) => {
                if (!opened) {
                  toast('未能自动打开权限页面，请手动前往「系统设置 → 应用管理」中开启', {
                    duration: 6000,
                  });
                }
              });
            },
          },
        });
      }
    } catch (error) {
      console.error('Unable to request Android widget installation:', error);
      showWidgetOutcome(size, 'error');
      toast.error('小组件添加失败，请稍后重试');
    } finally {
      setInstallingWidget(null);
    }
  };

  if (!settings) {
    return (
      <PageShell title="界面配置" subtitle="调整日历显示与桌面组件" decor="settings">
        <div className="empty-state">正在加载设置...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="界面配置"
      subtitle="调整日历显示与桌面组件"
      decor="settings"
      className="interface-settings-screen"
      action={
        <button type="button" className="round-action icon-pressable" onClick={() => navigate('/settings')} aria-label="返回设置">
          <ArrowLeft className="h-5 w-5" />
        </button>
      }
    >
      <section className="settings-group interface-config-group">
        <h2>日历样式</h2>
        <div className="calendar-style-options">
          {calendarStyleOptions.map(({ value, title, desc, icon: Icon }) => {
            const selected = selectedStyle === value;

            return (
              <button
                type="button"
                key={value}
                className={`calendar-style-option pressable ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                disabled={savingStyle}
                onClick={() => selectStyle(value)}
              >
                <span className="calendar-style-icon">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="calendar-style-copy">
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                <span className="calendar-style-check" data-visible={selected} aria-hidden="true">
                  <Check className="h-5 w-5" />
                </span>
              </button>
            );
          })}
        </div>
        <div className="cycle-statistics-setting">
          <span>
            <strong>显示周期统计</strong>
            <small>在日历日期下方显示周期天数，经期首日为 01</small>
          </span>
          <Switch
            checked={settings.showCycleStatistics ?? false}
            onCheckedChange={(checked) => void onUpdateSettings({ showCycleStatistics: checked })}
            aria-label="显示周期统计"
          />
        </div>
      </section>

      <section className="settings-group widget-install-group">
        <h2>小组件安装</h2>
        <div className="widget-install-options">
          {widgetOptions.map(({ size, title, footprint, desc, preview }) => {
            const installing = installingWidget === size;
            const outcome = widgetOutcome?.size === size ? widgetOutcome.status : null;
            const StateIcon = installing
              ? Loader
              : outcome === 'success'
                ? Check
                : outcome === 'error'
                  ? AlertTriangle
                  : Plus;

            return (
              <article className={`widget-install-option widget-install-option-${size}`} key={size}>
                <div className="widget-preview-stage">
                  <img src={preview} alt={`${title}预览`} />
                </div>
                <div className="widget-install-details">
                  <div className="widget-install-heading">
                    <strong>{title}</strong>
                    <span>{footprint}</span>
                  </div>
                  <p>{desc}</p>
                  <button
                    type="button"
                    className="widget-install-button pressable"
                    data-state={installing ? 'loading' : outcome || 'idle'}
                    disabled={!widgetPinAvailable || installingWidget !== null || outcome !== null}
                    onClick={() => installWidget(size)}
                  >
                    <StateIcon className={`h-4 w-4 ${installing ? 'is-loading' : ''}`} />
                    <span>{getWidgetButtonLabel(widgetPinAvailable, installing, outcome)}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}

function getWidgetButtonLabel(available: boolean, installing: boolean, outcome: 'success' | 'error' | null) {
  if (!available) return '仅 Android 可用';
  if (installing) return '正在打开...';
  if (outcome === 'success') return '已添加';
  if (outcome === 'error') return '请重试';
  return '添加到桌面';
}
