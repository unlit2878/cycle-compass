import type { ComponentType } from 'react';
import { ConfusedCircle, EmojiCircle, MehCircle, SadCircle, SmileCircle } from 'reicon-react';

export const emptyMoodLabel = '未选择';
// 只读汇总（首页最近记录卡片/日历摘要）里"没有情绪数据"的展示文案，与流量/疼痛的"未记录"对齐；
// LoggingScreen 的选择器里仍用 emptyMoodLabel（那个场景语义是"还没选"）。
export const noMoodSummaryLabel = '未记录';

// 心情五档：reicon 圆形表情族（很好→很糟糕），与 LoggingScreen/CalendarPage/Home 共用
export const moodOptionIcons: Array<ComponentType<{ className?: string }>> = [
  EmojiCircle,
  SmileCircle,
  MehCircle,
  SadCircle,
  ConfusedCircle,
];

export function getNextMoodSelection(currentMood: string | undefined, selectedMood: string): string | undefined {
  return currentMood === selectedMood ? undefined : selectedMood;
}
