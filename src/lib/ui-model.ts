import { FlowColor, FlowIntensity, normalizeFlowIntensity } from './db';

export const flowOptions: Array<{ value: FlowIntensity; label: string; tone: string; drops: number }> = [
  { value: 'very_light', label: '极少', tone: '#b7bdc0', drops: 1 },
  { value: 'light', label: '少量', tone: '#a9afb2', drops: 1 },
  { value: 'medium', label: '中等', tone: '#de4968', drops: 1 },
  { value: 'heavy', label: '较多', tone: '#9fa4a6', drops: 2 },
  { value: 'very_heavy', label: '非常多', tone: '#8d9295', drops: 3 },
];

export const flowColorOptions: Array<{ value: FlowColor; label: string; color: string }> = [
  { value: 'deep_red', label: '深红', color: '#d73e64' },
  { value: 'fresh_red', label: '鲜红', color: '#e85f62' },
  { value: 'dark_red', label: '暗红', color: '#b73555' },
  { value: 'brown', label: '褐色', color: '#b8874b' },
  { value: 'other', label: '其他', color: '#aeb3b3' },
];

export const symptomOptions = [
  '痛经',
  '腰酸',
  '腹胀',
  '头痛',
  '乳房胀痛',
  '情绪波动',
  '疲劳',
  '失眠',
  '便秘',
  '腹泻',
  '长痘',
  '食欲变化',
  '水肿',
  '恶心',
];

export const moodOptions = ['很好', '还不错', '一般', '有点差', '很糟糕'];

export function getFlowLabel(value?: string) {
  const normalized = normalizeFlowIntensity(value);
  return flowOptions.find((item) => item.value === normalized)?.label || '未记录';
}

export function getFlowColor(value?: string) {
  return flowColorOptions.find((item) => item.value === value)?.color || '#de4968';
}

export function formatDateCN(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatMonthCN(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatShortCN(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function weekdayCN(date: Date) {
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
}

export function weekdayShortCN(date: Date) {
  return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
}

export function dateFromISO(date: string) {
  return new Date(`${date}T12:00:00`);
}
