import {
  Frown,
  Meh,
  Smile,
  SmilePlus,
  type LucideIcon,
} from 'lucide-react';

export const emptyMoodLabel = '未选择';

export const moodOptionIcons: LucideIcon[] = [
  SmilePlus,
  Smile,
  Meh,
  Meh,
  Frown,
];

export function getNextMoodSelection(currentMood: string | undefined, selectedMood: string): string | undefined {
  return currentMood === selectedMood ? undefined : selectedMood;
}
