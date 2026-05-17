import { ArrowLeft, CalendarDays, Check, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/AppScaffold';
import { CalendarPhaseStyle, Settings as SettingsType } from '@/lib/db';
import { toast } from 'sonner';

interface InterfaceSettingsPageProps {
  settings: SettingsType | null;
  onUpdateSettings: (updates: Partial<SettingsType>) => Promise<SettingsType>;
}

const calendarStyleOptions: Array<{
  value: CalendarPhaseStyle;
  title: string;
  desc: string;
  icon: LucideIcon;
}> = [
  {
    value: 'classic',
    title: '样式一',
    desc: '阶段以柔和背景呈现，记录使用底部圆点标记',
    icon: CalendarDays,
  },
  {
    value: 'underline',
    title: '样式二',
    desc: '阶段以日期下方纹理线呈现，记录使用叶子标记',
    icon: CalendarDays,
  },
];

export function InterfaceSettingsPage({ settings, onUpdateSettings }: InterfaceSettingsPageProps) {
  const navigate = useNavigate();
  const selectedStyle = settings?.calendarPhaseStyle || 'classic';

  const selectStyle = async (style: CalendarPhaseStyle) => {
    if (style === selectedStyle) return;
    await onUpdateSettings({ calendarPhaseStyle: style });
    toast.success(`日历样式已切换为${style === 'underline' ? '样式二' : '样式一'}`);
  };

  if (!settings) {
    return (
      <PageShell title="界面配置" subtitle="调整日历和视觉显示" decor="settings">
        <div className="empty-state">正在加载设置...</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="界面配置"
      subtitle="调整日历和视觉显示"
      decor="settings"
      className="interface-settings-screen"
      action={
        <button type="button" className="round-action" onClick={() => navigate('/settings')} aria-label="返回设置">
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
                className={`calendar-style-option ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => selectStyle(value)}
              >
                <span className="calendar-style-icon">
                  <Icon className="h-7 w-7" />
                </span>
                <span className="calendar-style-copy">
                  <strong>{title}</strong>
                  <small>{desc}</small>
                </span>
                <span className="calendar-style-check" aria-hidden="true">
                  {selected && <Check className="h-5 w-5" />}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </PageShell>
  );
}
