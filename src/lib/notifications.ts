import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// 请求通知权限
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('请求通知权限失败:', error);
    return false;
  }
}

// 检查通知权限
export async function checkNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  
  try {
    const permission = await LocalNotifications.checkPermissions();
    return permission.display === 'granted';
  } catch (error) {
    console.error('检查通知权限失败:', error);
    return false;
  }
}

// 安排经期提醒
export async function schedulePeriodReminder(
  nextPeriodDate: Date,
  daysBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // 先取消之前的通知
    await cancelAllNotifications();
    
    const reminderDate = new Date(nextPeriodDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(9, 0, 0, 0);
    
    // 只有当提醒日期在未来才安排通知
    if (reminderDate > new Date()) {
      await LocalNotifications.schedule({
        notifications: [{
          id: 1,
          title: '知期提醒',
          body: `您的经期预计在 ${daysBefore} 天后到来，请做好准备`,
          schedule: { at: reminderDate },
          sound: 'default',
        }],
      });
      console.log('通知已安排:', reminderDate);
    }
  } catch (error) {
    console.error('安排通知失败:', error);
  }
}

// 安排排卵期提醒
export async function scheduleOvulationReminder(
  ovulationDate: Date,
  daysBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const reminderDate = new Date(ovulationDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(9, 0, 0, 0);
    
    if (reminderDate > new Date()) {
      await LocalNotifications.schedule({
        notifications: [{
          id: 2,
          title: '知期提醒',
          body: `您的排卵期预计在 ${daysBefore} 天后到来`,
          schedule: { at: reminderDate },
          sound: 'default',
        }],
      });
    }
  } catch (error) {
    console.error('安排排卵期通知失败:', error);
  }
}

// 取消所有通知
export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ 
        notifications: pending.notifications.map(n => ({ id: n.id })) 
      });
    }
  } catch (error) {
    console.error('取消通知失败:', error);
  }
}
