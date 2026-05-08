import { ChangeEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clipboard, FileJson, Upload } from 'lucide-react';
import { PageShell } from '@/components/AppScaffold';
import { BackupData } from '@/lib/db';
import { toast } from 'sonner';

interface DataImportPageProps {
  onImport: (data: BackupData) => Promise<void>;
}

const AI_IMPORT_PROMPT = `你是一个严谨的数据整理助手。请根据我接下来提供的经期记录截图、表格或文字，整理成“知期”APP可以导入的 JSON。

只输出一个合法 JSON 对象，不要使用 Markdown，不要解释。

JSON 结构必须是：
{
  "version": 4,
  "exportDate": "当前 ISO 时间",
  "settings": {
    "id": 1,
    "onboardingComplete": true,
    "lastPeriodStart": "最近一次经期开始日期，YYYY-MM-DD",
    "averageCycleLength": 28,
    "averagePeriodLength": 5,
    "reminderPeriodApproaching": true,
    "reminderPeriodDays": 2,
    "reminderOvulation": false,
    "reminderDailyLog": false,
    "darkMode": false,
    "backupReminderInterval": "weekly",
    "persistentStorageGranted": false
  },
  "cycles": [
    { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
  ],
  "dailyLogs": []
}

整理规则：
1. 每一段经期生成一条 cycles 记录，startDate 是开始日，endDate 是结束日。
2. 如果只知道开始日，不确定结束日，可以省略 endDate。
3. 所有日期必须用 YYYY-MM-DD。
4. lastPeriodStart 必须等于 cycles 中最近一次 startDate。
5. averagePeriodLength 用已知经期天数平均值，没有足够信息时用 5。
6. averageCycleLength 用相邻经期开始日间隔平均值，没有足够信息时用 28。
7. 不要编造截图或文字里没有的经期记录。`;

const JSON_EXAMPLE = `{
  "version": 4,
  "exportDate": "2026-05-08T12:00:00.000Z",
  "settings": {
    "id": 1,
    "onboardingComplete": true,
    "lastPeriodStart": "2026-04-20",
    "averageCycleLength": 28,
    "averagePeriodLength": 5,
    "reminderPeriodApproaching": true,
    "reminderPeriodDays": 2,
    "reminderOvulation": false,
    "reminderDailyLog": false,
    "darkMode": false,
    "backupReminderInterval": "weekly",
    "persistentStorageGranted": false
  },
  "cycles": [
    { "startDate": "2026-03-23", "endDate": "2026-03-27" },
    { "startDate": "2026-04-20", "endDate": "2026-04-24" }
  ],
  "dailyLogs": []
}`;

export function DataImportPage({ onImport }: DataImportPageProps) {
  const [jsonText, setJsonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const importJson = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error('请先粘贴 JSON，或选择 JSON 文件');
      return;
    }

    setBusy(true);
    try {
      await onImport(JSON.parse(trimmed) as BackupData);
      toast.success('数据导入成功');
      navigate('/settings');
    } catch {
      toast.error('导入失败，请检查 JSON 格式');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonText(text);
      await importJson(text);
    } finally {
      event.target.value = '';
    }
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success('已复制');
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1400);
    } catch {
      toast.error('复制失败，请手动选择复制');
    }
  };

  return (
    <PageShell
      title="导入数据"
      subtitle="选择 JSON 文件，或粘贴整理好的备份 JSON"
      decor="settings"
      className="data-import-screen"
      action={
        <button type="button" className="round-action" onClick={() => navigate('/settings')} aria-label="返回设置">
          <ArrowLeft className="h-5 w-5" />
        </button>
      }
    >
      <section className="data-import-actions">
        <button type="button" className="dialog-primary-action" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          选择 JSON 文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </section>

      <section className="data-import-section">
        <div className="inline-section-title">
          <h2>粘贴 JSON</h2>
        </div>
        <textarea
          className="data-import-textarea"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          placeholder="请粘贴正确的 JSON 数据"
          spellCheck={false}
        />
        <button
          type="button"
          className="dialog-primary-action"
          disabled={busy}
          onClick={() => importJson(jsonText)}
        >
          <FileJson className="h-4 w-4" />
          {busy ? '导入中...' : '导入粘贴内容'}
        </button>
      </section>

      <section className="data-import-section">
        <div className="inline-section-title">
          <h2>AI 整理提示词</h2>
        </div>
        <CopyablePre
          label="复制提示词"
          copied={copied === 'prompt'}
          onCopy={() => copyText('prompt', AI_IMPORT_PROMPT)}
        >
          {AI_IMPORT_PROMPT}
        </CopyablePre>
      </section>

      <section className="data-import-section">
        <div className="inline-section-title">
          <h2>JSON 示例</h2>
        </div>
        <CopyablePre
          label="复制示例"
          copied={copied === 'example'}
          onCopy={() => copyText('example', JSON_EXAMPLE)}
        >
          {JSON_EXAMPLE}
        </CopyablePre>
      </section>
    </PageShell>
  );
}

function CopyablePre({
  label,
  copied,
  onCopy,
  children,
}: {
  label: string;
  copied: boolean;
  onCopy: () => void;
  children: string;
}) {
  return (
    <div className="copyable-pre">
      <button type="button" onClick={onCopy}>
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
        {copied ? '已复制' : label}
      </button>
      <pre>{children}</pre>
    </div>
  );
}
