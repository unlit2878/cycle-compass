import { describe, it, expect } from 'vitest';
import { getRelativeDaysLabel } from '../ui-model';
import { getMoodSummaryIcon, getFlowSummaryIcon, getPainSummaryIcon } from '@/components/record-icon-maps';
import { NotRecordedIcon } from '@/components/reicon-custom-icons';
import { MehCircle } from 'reicon-react';

function noonDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

describe('getRelativeDaysLabel', () => {
  const today = noonDate(2026, 9, 5);

  it('同一天显示"今天"', () => {
    expect(getRelativeDaysLabel(noonDate(2026, 9, 5), today)).toBe('今天');
  });

  it('前一天显示"昨天"', () => {
    expect(getRelativeDaysLabel(noonDate(2026, 9, 4), today)).toBe('昨天');
  });

  it('30 天内显示"N天前"', () => {
    expect(getRelativeDaysLabel(noonDate(2026, 9, 3), today)).toBe('2天前');
    expect(getRelativeDaysLabel(noonDate(2026, 8, 6), today)).toBe('30天前');
  });

  it('超过 30 天按 30 天粗算为"N个月前"', () => {
    // 2026-08-05 → 2026-09-05 实际 31 天
    expect(getRelativeDaysLabel(noonDate(2026, 8, 5), today)).toBe('1个月前');
    expect(getRelativeDaysLabel(noonDate(2026, 3, 5), today)).toBe('6个月前');
  });

  it('未来日期按"今天"兜底（不产生负数文案）', () => {
    expect(getRelativeDaysLabel(noonDate(2026, 9, 6), today)).toBe('今天');
  });
});

describe('记录汇总图标的空值回退', () => {
  it('情绪为空回退"未记录"虚线图标，不再借用"一般"图标', () => {
    expect(getMoodSummaryIcon(undefined)).toBe(NotRecordedIcon);
    expect(getMoodSummaryIcon(undefined)).not.toBe(MehCircle);
    expect(getMoodSummaryIcon('很好')).not.toBe(NotRecordedIcon);
  });

  it('流量/疼痛为空同样回退"未记录"图标', () => {
    expect(getFlowSummaryIcon(undefined)).toBe(NotRecordedIcon);
    expect(getPainSummaryIcon(undefined)).toBe(NotRecordedIcon);
  });

  it('疼痛"无"是真实档位，仍用 Ban 图标而非"未记录"', () => {
    expect(getPainSummaryIcon('none')).not.toBe(NotRecordedIcon);
  });
});
