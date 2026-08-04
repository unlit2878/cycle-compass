import { Capacitor, registerPlugin } from '@capacitor/core';
import type { WidgetSnapshot } from './widget-snapshot';

interface CycleWidgetPlugin {
  updateWidget(options: { snapshot: WidgetSnapshot }): Promise<void>;
}

const CycleWidget = registerPlugin<CycleWidgetPlugin>('CycleWidget');

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
