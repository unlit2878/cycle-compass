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

// 其余记录图标已迁移至 reicon（reicon-react）与 reicon-custom-icons.ts，
// 这里仅保留 reicon 没有对应替代的自绘图标。

export function FatigueIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M6.4 10.5h18.7a1.7 1.7 0 0 1 1.7 1.7v7.6a1.7 1.7 0 0 1-1.7 1.7H6.4a1.7 1.7 0 0 1-1.7-1.7v-7.6a1.7 1.7 0 0 1 1.7-1.7Z" />
      <path d="M28.2 14.1h1.4v3.8h-1.4" />
      <path d="M8.8 13.5h2.5v5H8.8z" />
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

export function InsomniaIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21.3 4.6a11.7 11.7 0 1 0 5.9 20.1A12.9 12.9 0 0 1 21.3 4.6Z" />
      <path d="M24.3 9.2h2.5l-2.7 3h2.7" />
      <path d="M28.3 5.4h2l-2.2 2.5h2.2" />
    </svg>
  );
}
