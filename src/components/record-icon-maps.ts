import type { ComponentType } from 'react';
import { moodOptionIcons } from '@/components/mood-options';
import { Ban, Bolt, Drop, Droplet, Drops, MehCircle } from 'reicon-react';
import {
  BloatingIcon,
  ConstipationIcon,
  DiarrheaIcon,
  FlowMediumIcon,
  FlowVeryHeavyIcon,
  PainModerateIcon,
  PainSevereIcon,
} from '@/components/reicon-custom-icons';
import { normalizeFlowIntensity, normalizePainLevel } from '@/lib/db';
import { moodOptions } from '@/lib/ui-model';

// 图标契约：渲染处仅传 className（见 record-icon-maps 的消费方）。
export type RecordSummaryIcon = ComponentType<{ className?: string }>;

export function getFlowSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizeFlowIntensity(value);
  if (normalized === 'very_light') return Drop;
  if (normalized === 'light') return Droplet;
  if (normalized === 'medium') return FlowMediumIcon;
  if (normalized === 'heavy') return Drops;
  if (normalized === 'very_heavy') return FlowVeryHeavyIcon;
  return Drop;
}

export function getPainSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizePainLevel(value);
  if (normalized === 'none') return Ban;
  if (normalized === 'mild') return Bolt;
  if (normalized === 'moderate') return PainModerateIcon;
  if (normalized === 'severe') return PainSevereIcon;
  return Ban;
}

export function getMoodSummaryIcon(value?: string): RecordSummaryIcon {
  const index = moodOptions.findIndex((item) => item === value);
  return index >= 0 ? moodOptionIcons[index] : MehCircle;
}
