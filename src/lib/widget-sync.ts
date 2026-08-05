import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import type { WidgetSnapshot } from './widget-snapshot';

export type WidgetSize = 'medium' | 'large';

export interface WidgetPinResult {
  supported: boolean;
  requested: boolean;
  /** Instances already on the home screen when the request was handed off. */
  pinnedCount: number;
}

/**
 * `added`      - an extra instance appeared, so the user confirmed.
 * `dismissed`  - the confirmation showed but nothing was added (cancelled).
 * `blocked`    - the confirmation never took focus. On MIUI/HyperOS, ColorOS,
 *                OriginOS and EMUI the launcher advertises pin support and the
 *                system reports the request as delivered, then drops the dialog
 *                because the "桌面快捷方式" / "后台弹出界面" permissions are off.
 */
export type WidgetPinOutcome = 'added' | 'dismissed' | 'blocked';

interface CycleWidgetPlugin {
  updateWidget(options: { snapshot: WidgetSnapshot }): Promise<void>;
  requestPinWidget(options: { size: WidgetSize }): Promise<WidgetPinResult>;
  getPinnedCount(options: { size: WidgetSize }): Promise<{ count: number }>;
  openPermissionSettings(): Promise<{ opened: boolean; route: string }>;
}

const CycleWidget = registerPlugin<CycleWidgetPlugin>('CycleWidget');

export function canRequestWidgetPin(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function requestWidgetPin(size: WidgetSize): Promise<WidgetPinResult> {
  if (!canRequestWidgetPin()) {
    return { supported: false, requested: false, pinnedCount: 0 };
  }

  return CycleWidget.requestPinWidget({ size });
}

/**
 * Jumps to the OS page where the user can grant the OEM permissions that gate
 * the pin dialog. There is no API to pop the individual grant prompt, so this
 * is the closest we can get to guiding them there. Resolves false if no
 * settings screen could be opened (or off Android).
 */
export async function openWidgetPermissionSettings(): Promise<boolean> {
  if (!canRequestWidgetPin()) return false;
  try {
    const { opened } = await CycleWidget.openPermissionSettings();
    return opened;
  } catch (error) {
    console.warn('Unable to open widget permission settings:', error);
    return false;
  }
}

async function pinnedCount(size: WidgetSize): Promise<number> {
  const { count } = await CycleWidget.getPinnedCount({ size });
  return count;
}

/** Resolves true once the app state matches `active`, false if it never does. */
function waitForAppState(active: boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let remove: (() => void) | null = null;

    const finish = (matched: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      remove?.();
      resolve(matched);
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);

    CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive === active) finish(true);
    }).then((listener) => {
      remove = () => listener.remove();
      if (settled) remove();
    });
  });
}

/**
 * Watches what the launcher actually did after a pin request.
 *
 * The confirmation is a real activity, so a working flow always backgrounds us
 * first. No background within `handoffMs` means the dialog was never drawn —
 * the count is re-read anyway in case a launcher pins without taking focus.
 */
export async function waitForWidgetPinOutcome(
  size: WidgetSize,
  countBefore: number,
  handoffMs = 2500,
  confirmMs = 120000,
): Promise<WidgetPinOutcome> {
  const backgrounded = await waitForAppState(false, handoffMs);
  if (!backgrounded) {
    return (await pinnedCount(size)) > countBefore ? 'added' : 'blocked';
  }

  await waitForAppState(true, confirmMs);
  return (await pinnedCount(size)) > countBefore ? 'added' : 'dismissed';
}

/** Sync is intentionally a no-op in the browser and installed PWA. */
export async function syncWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;

  try {
    await CycleWidget.updateWidget({ snapshot });
  } catch (error) {
    // A missing/outdated native plugin must never prevent the app from loading.
    console.warn('Unable to update Android cycle widget:', error);
  }
}
