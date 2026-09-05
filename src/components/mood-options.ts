import type { ComponentType } from 'react';
import { ConfusedCircle, EmojiCircle, MehCircle, SadCircle, SmileCircle } from 'reicon-react';

export const emptyMoodLabel = '未选择';

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
