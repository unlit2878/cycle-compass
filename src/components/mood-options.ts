import type { ComponentType, SVGProps } from 'react';
import { MoodAwfulIcon, MoodBadIcon, MoodGoodIcon, MoodGreatIcon, MoodNeutralIcon } from './record-icons';

export const emptyMoodLabel = '未选择';

export const moodOptionIcons: Array<ComponentType<SVGProps<SVGSVGElement>>> = [
  MoodGreatIcon,
  MoodGoodIcon,
  MoodNeutralIcon,
  MoodBadIcon,
  MoodAwfulIcon,
];

export function getNextMoodSelection(currentMood: string | undefined, selectedMood: string): string | undefined {
  return currentMood === selectedMood ? undefined : selectedMood;
}
