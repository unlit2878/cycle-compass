import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: '0 0 32 32',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function FlowVeryLightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 5.7C10.7 11.8 8.2 16.1 8.2 19.8a7.8 7.8 0 0 0 15.6 0c0-3.7-2.5-8-7.8-14.1Z" />
    </svg>
  );
}

export function FlowLightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 5.7C10.7 11.8 8.2 16.1 8.2 19.8a7.8 7.8 0 0 0 15.6 0c0-3.7-2.5-8-7.8-14.1Z" />
      <path d="M12.3 23.3c2.2 1.2 5.2 1.2 7.4 0" opacity="0.58" />
    </svg>
  );
}

export function FlowMediumIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 5.7C10.7 11.8 8.2 16.1 8.2 19.8a7.8 7.8 0 0 0 15.6 0c0-3.7-2.5-8-7.8-14.1Z" />
      <path d="M11.2 20h9.6" />
    </svg>
  );
}

export function FlowHeavyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13.4 6.8c-4.1 4.7-6 7.9-6 10.8a6 6 0 0 0 12 0c0-2.9-1.9-6.1-6-10.8Z" />
      <path d="M22.2 12.3c-3 3.4-4.4 5.7-4.4 7.8a4.5 4.5 0 0 0 9 0c0-2.1-1.4-4.4-4.6-7.8Z" />
    </svg>
  );
}

export function FlowVeryHeavyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10.3 9.5c-3.2 3.7-4.7 6.2-4.7 8.4a4.8 4.8 0 0 0 9.6 0c0-2.2-1.5-4.7-4.9-8.4Z" />
      <path d="M17 5.8c-4 4.7-5.9 7.9-5.9 10.8a5.9 5.9 0 0 0 11.8 0c0-2.9-1.9-6.1-5.9-10.8Z" />
      <path d="M23.5 10.1c-3.2 3.7-4.7 6.2-4.7 8.4a4.8 4.8 0 0 0 9.6 0c0-2.2-1.5-4.7-4.9-8.4Z" />
    </svg>
  );
}

export function PainMildIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m18.4 3.8-8 14.2h6.4l-2.6 10.2 8.6-14.8h-6.2l1.8-9.6Z" />
    </svg>
  );
}

export function PainNoneIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="16" cy="16" r="8.8" />
      <path d="M10 22 22 10" />
    </svg>
  );
}

export function PainModerateIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m14.3 3.8-8 14.2h6.4l-2.6 10.2 8.6-14.8h-6.2l1.8-9.6Z" />
      <path d="m24.6 6.4-5.5 9.5h4.3l-1.8 6.9 6-10.1h-4.3l1.3-6.3Z" />
    </svg>
  );
}

export function PainSevereIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m10.8 3.8-7.6 13.5h6.1L7 27l8.1-14.2H9.2l1.6-9Z" />
      <path d="m23 3.8-7.6 13.5h6.1L19.2 27l8.1-14.2h-5.9l1.6-9Z" />
    </svg>
  );
}

export function PeriodStartIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 4.5c-5.1 5.9-7.5 9.8-7.5 13.3a7.5 7.5 0 0 0 15 0c0-3.5-2.4-7.4-7.5-13.3Z" />
      <path d="M13.2 19.4c1.6 1.3 4 1.3 5.6 0" opacity="0.72" />
      <path d="M7.4 23.6 5.5 25.5" />
      <path d="m24.6 8.1 1.7-1.7" />
      <path d="m23.9 6.1 3.1 3.1" />
    </svg>
  );
}

export function PeriodEndIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 4.5c-5.1 5.9-7.5 9.8-7.5 13.3a7.5 7.5 0 0 0 15 0c0-3.5-2.4-7.4-7.5-13.3Z" />
      <path d="m12.2 15.1 7.6 7.6" />
      <path d="m19.8 15.1-7.6 7.6" />
    </svg>
  );
}

export function WaistSorenessIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M11.6 4.4c2.6 6.3 2.3 15.5-1 22.1" />
      <path d="M20.4 4.4c-2.6 6.3-2.3 15.5 1 22.1" />
      <path d="M15.8 27.1v-2.9" />
      <path d="M7.4 14.3l-3.1-1.7" />
      <path d="m7.7 18.3-3.2 1.6" />
      <path d="m24.6 14.3 3.1-1.7" />
      <path d="m24.3 18.3 3.2 1.6" />
    </svg>
  );
}

export function BloatingIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9.2 19.5c2.5-5.6 9.8-5.1 13.7-1.9" />
      <path d="M23 17.6c2.8-5.7-.9-10.9-6.3-10.9h-3.3" />
      <path d="M13.4 6.7c1.4 2.7-.3 5.6-3.3 5.8" />
      <path d="M13.4 6.7c-2.3.5-3.9 1.8-4.8 4.2" />
      <path d="M16.4 21.5h.1" />
      <path d="M20.2 20.1h.1" />
      <path d="M23.3 22.6h.1" />
      <path d="M17 25h.1" />
    </svg>
  );
}

export function HeadacheIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16.4 26.3h-4.1v-6.7H9.8c1-2.3 2-4.5 2-7 0-4.3 3.4-7.7 8.3-7.7" />
      <path d="m23.2 3.6-3.1 5.5h4.1L20.8 15" />
      <path d="m27.3 9.2-2.5 4.5h3.2l-2.7 4.9" />
    </svg>
  );
}

export function BreastPainIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 25.4S5.8 19.7 5.8 12.6c0-3.4 2.6-5.8 5.6-5.8 1.9 0 3.6 1 4.6 2.6 1-1.6 2.7-2.6 4.6-2.6 3 0 5.6 2.4 5.6 5.8C26.2 19.7 16 25.4 16 25.4Z" />
      <path d="m10.3 16.5 3.2-3.2 3.8 5.8 2.2-3.3h4.1" />
    </svg>
  );
}

export function FatigueIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6.4 10.5h18.7a1.7 1.7 0 0 1 1.7 1.7v7.6a1.7 1.7 0 0 1-1.7 1.7H6.4a1.7 1.7 0 0 1-1.7-1.7v-7.6a1.7 1.7 0 0 1 1.7-1.7Z" />
      <path d="M28.2 14.1h1.4v3.8h-1.4" />
      <path d="M8.8 13.5h2.5v5H8.8z" />
    </svg>
  );
}

export function InsomniaIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21.3 4.6a11.7 11.7 0 1 0 5.9 20.1A12.9 12.9 0 0 1 21.3 4.6Z" />
      <path d="M24.3 9.2h2.5l-2.7 3h2.7" />
      <path d="M28.3 5.4h2l-2.2 2.5h2.2" />
    </svg>
  );
}

export function ConstipationIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.8 5.8h14.4v11.1a5.2 5.2 0 0 1-5.2 5.2h-4a5.2 5.2 0 0 1-5.2-5.2Z" />
      <path d="M8 22.1h16" />
      <path d="M12 22.1 8.6 27h14.8L20 22.1" />
    </svg>
  );
}

export function DiarrheaIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8.1 6.6h14.1a4 4 0 0 1 4 4v1.9a4 4 0 0 1-4 4h-1.4v9.1H9.9V10.8a4.2 4.2 0 0 1 4.2-4.2" />
      <path d="M20.8 6.6v9.9" />
      <path d="M20.8 16.5c3.2-.1 5.4-2.3 5.4-5.2" />
    </svg>
  );
}

export function AcneIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18.4 5.1c-5.4 2.2-8.4 6.5-8.4 11.6v9.2h8.2" />
      <path d="M22.1 7.1c1.5.8 2.4 2.1 2.8 3.8" />
      <path d="M23.8 14.6c-.3 1.4-.9 2.6-1.8 3.5" />
      <path d="M14.7 14.6c.5.6 1.3.6 1.8 0" />
      <path d="M15.3 20.7c1.3.9 3.1.9 4.4 0" />
      <path d="M23.2 20.1h.1" />
      <path d="M25.2 17.2h.1" />
      <path d="M23.9 23.5h.1" />
    </svg>
  );
}

export function AppetiteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9.3 4.7v22.6" />
      <path d="M5.4 4.7v8.5a3.9 3.9 0 0 0 7.8 0V4.7" />
      <path d="M27.1 4.7v22.6" />
      <path d="M27.1 4.7c-5.4 2.8-7.3 8.4-5.8 13.2h5.8" />
    </svg>
  );
}

export function EdemaIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 4.7c-4.8 5.5-7 9.3-7 12.8a7 7 0 0 0 14 0c0-3.5-2.2-7.3-7-12.8Z" />
      <path d="M5.2 24c2.6-1.8 4.9-1.8 7.4 0s4.8 1.8 7.4 0 4.9-1.8 7.4 0" />
      <path d="M5.2 27.4c2.6-1.8 4.9-1.8 7.4 0s4.8 1.8 7.4 0 4.9-1.8 7.4 0" />
    </svg>
  );
}

export function NauseaIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="15.8" cy="14.4" r="10.3" />
      <path d="M11.8 11.5c.5.8 1.4.8 1.9 0" />
      <path d="M17.9 11.5c.5.8 1.4.8 1.9 0" />
      <path d="M13.5 19.8c1.5-1.5 3.3-1.5 4.8 0" />
      <path d="M22.5 21.2c1.6.4 2.9 1.8 3.8 4.2" />
      <path d="M24.3 19.2c1.9.7 3.3 2.1 4.2 4.2" />
    </svg>
  );
}

export function MoodGreatIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="14.1" cy="17.5" r="9.8" />
      <path d="M10.4 15h.1" />
      <path d="M17.8 15h.1" />
      <path d="M10.4 20.5c2.2 1.9 5.2 1.9 7.4 0" />
      <path d="m23 5.5 1.4 3.2 3.2 1.4-3.2 1.4-1.4 3.2-1.4-3.2-3.2-1.4 3.2-1.4Z" />
      <path d="m28.3 14.8.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7Z" />
    </svg>
  );
}

export function MoodGoodIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="16" cy="16" r="10.4" />
      <path d="M12.2 13.6h.1" />
      <path d="M19.8 13.6h.1" />
      <path d="M11.7 19.4c2.6 2.2 6 2.2 8.6 0" />
    </svg>
  );
}

export function MoodNeutralIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="16" cy="16" r="10.4" />
      <path d="M12.2 13.6h.1" />
      <path d="M19.8 13.6h.1" />
      <path d="M12 20h8" />
    </svg>
  );
}

export function MoodBadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="16" cy="16" r="10.4" />
      <path d="M12.2 13.6h.1" />
      <path d="M19.8 13.6h.1" />
      <path d="M11.8 21.2c2.6-2 5.8-2 8.4 0" />
    </svg>
  );
}

export function MoodAwfulIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="16" cy="16" r="10.4" />
      <path d="m11.3 13 2.1 1.4" />
      <path d="m20.7 13-2.1 1.4" />
      <path d="M11.5 22.1c2.8-3 6.2-3 9 0" />
      <path d="M10 25.7c.7 1.4 1.9 1.4 2.6 0 .7 1.4 1.9 1.4 2.6 0" opacity="0.72" />
    </svg>
  );
}
