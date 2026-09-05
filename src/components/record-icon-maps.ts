import type { ComponentType } from 'react';
import { moodOptionIcons } from '@/components/mood-options';
import { Ban, Bolt, Drop, Droplet, Drops } from 'reicon-react';
import {
  BloatingIcon,
  ConstipationIcon,
  DiarrheaIcon,
  FlowMediumIcon,
  FlowVeryHeavyIcon,
  NotRecordedIcon,
  PainModerateIcon,
  PainSevereIcon,
} from '@/components/reicon-custom-icons';
import { normalizeFlowIntensity, normalizePainLevel } from '@/lib/db';
import { moodOptions } from '@/lib/ui-model';

// 图标契约：渲染处仅传 className（见 record-icon-maps 的消费方）。
export type RecordSummaryIcon = ComponentType<{ className?: string }>;

// 空值/非法值一律回退 NotRecordedIcon（虚线空圆），
// 不再借用任何真实档位的图标——"未记录"必须与"一般"/"无"等档位在视觉上可区分。
export function getFlowSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizeFlowIntensity(value);
  if (normalized === 'very_light') return Drop;
  if (normalized === 'light') return Droplet;
  if (normalized === 'medium') return FlowMediumIcon;
  if (normalized === 'heavy') return Drops;
  if (normalized === 'very_heavy') return FlowVeryHeavyIcon;
  return NotRecordedIcon;
}

export function getPainSummaryIcon(value?: string): RecordSummaryIcon {
  const normalized = normalizePainLevel(value);
  if (normalized === 'none') return Ban;
  if (normalized === 'mild') return Bolt;
  if (normalized === 'moderate') return PainModerateIcon;
  if (normalized === 'severe') return PainSevereIcon;
  return NotRecordedIcon;
}

export function getMoodSummaryIcon(value?: string): RecordSummaryIcon {
  const index = moodOptions.findIndex((item) => item === value);
  return index >= 0 ? moodOptionIcons[index] : NotRecordedIcon;
}
