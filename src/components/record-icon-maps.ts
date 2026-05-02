import type { ComponentType, SVGProps } from 'react';
import { moodOptionIcons } from '@/components/mood-options';
import {
  FlowHeavyIcon,
  FlowLightIcon,
  FlowMediumIcon,
  FlowVeryHeavyIcon,
  FlowVeryLightIcon,
  MoodNeutralIcon,
  PainMildIcon,
  PainModerateIcon,
  PainNoneIcon,
  PainSevereIcon,
} from '@/components/record-icons';
import { normalizeFlowIntensity, normalizePainLevel } from '@/lib/db';
import { moodOptions } from '@/lib/ui-model';

export type RecordSummaryIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function getFlowSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizeFlowIntensity(value);
  if (normalized === 'very_light') return FlowVeryLightIcon;
  if (normalized === 'light') return FlowLightIcon;
  if (normalized === 'medium') return FlowMediumIcon;
  if (normalized === 'heavy') return FlowHeavyIcon;
  if (normalized === 'very_heavy') return FlowVeryHeavyIcon;
  return FlowVeryLightIcon;
}

export function getPainSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizePainLevel(value);
  if (normalized === 'none') return PainNoneIcon;
  if (normalized === 'mild') return PainMildIcon;
  if (normalized === 'moderate') return PainModerateIcon;
  if (normalized === 'severe') return PainSevereIcon;
  return PainNoneIcon;
}

export function getMoodSummaryIcon(value?: string): RecordSummaryIcon {
  const index = moodOptions.findIndex((item) => item === value);
  return index >= 0 ? moodOptionIcons[index] : MoodNeutralIcon;
}
