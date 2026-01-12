import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// 通知ID常量
const NOTIFICATION_IDS = {
  PERIOD_REMINDER: 1,
  OVULATION_REMINDER: 2,
  DAILY_REMINDER: 3,
};

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
    // 先取消之前的经期提醒
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_IDS.PERIOD_REMINDER }] });
    
    const reminderDate = new Date(nextPeriodDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(9, 0, 0, 0);
    
    // 只有当提醒日期在未来才安排通知
    if (reminderDate > new Date()) {
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTIFICATION_IDS.PERIOD_REMINDER,
          title: '知期提醒',
          body: `您的经期预计在 ${daysBefore} 天后到来，请做好准备`,
          schedule: { at: reminderDate },
          sound: 'default',
        }],
      });
      console.log('经期提醒已安排:', reminderDate);
    }
  } catch (error) {
    console.error('安排经期通知失败:', error);
  }
}

// 安排排卵期提醒
export async function scheduleOvulationReminder(
  ovulationDate: Date,
  daysBefore: number
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // 先取消之前的排卵期提醒
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_IDS.OVULATION_REMINDER }] });
    
    const reminderDate = new Date(ovulationDate);
    reminderDate.setDate(reminderDate.getDate() - daysBefore);
    reminderDate.setHours(9, 0, 0, 0);
    
    if (reminderDate > new Date()) {
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTIFICATION_IDS.OVULATION_REMINDER,
          title: '知期提醒',
          body: `您的排卵期预计在 ${daysBefore} 天后到来`,
          schedule: { at: reminderDate },
          sound: 'default',
        }],
      });
      console.log('排卵期提醒已安排:', reminderDate);
    }
  } catch (error) {
    console.error('安排排卵期通知失败:', error);
  }
}

// 安排每日记录提醒（每天晚上8点提醒）
export async function scheduleDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    // 先取消之前的每日提醒
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_IDS.DAILY_REMINDER }] });
    
    // 设置明天晚上8点的提醒
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(20, 0, 0, 0);
    
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIFICATION_IDS.DAILY_REMINDER,
        title: '知期提醒',
        body: '别忘了记录今天的身体状况哦~',
        schedule: {
          at: tomorrow,
          every: 'day', // 每天重复
          allowWhileIdle: true,
        },
        sound: 'default',
      }],
    });
    console.log('每日提醒已安排，首次提醒时间:', tomorrow);
  } catch (error) {
    console.error('安排每日提醒失败:', error);
  }
}

// 取消每日提醒
export async function cancelDailyReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_IDS.DAILY_REMINDER }] });
    console.log('每日提醒已取消');
  } catch (error) {
    console.error('取消每日提醒失败:', error);
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
    console.log('所有通知已取消');
  } catch (error) {
    console.error('取消通知失败:', error);
  }
}

// 初始化通知（应用启动时调用）
export async function initializeNotifications(settings: {
  reminderPeriodApproaching: boolean;
  reminderOvulation: boolean;
  reminderDailyLog: boolean;
  reminderPeriodDays: number;
  lastPeriodStart?: string;
  averageCycleLength: number;
}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) return;
  
  // 安排每日提醒
  if (settings.reminderDailyLog) {
    await scheduleDailyReminder();
  }
  
  // 安排经期和排卵期提醒
  if (settings.lastPeriodStart && (settings.reminderPeriodApproaching || settings.reminderOvulation)) {
    const lastStart = new Date(settings.lastPeriodStart);
    const cycleLength = settings.averageCycleLength || 28;
    
    // 计算下次经期日期
    const now = new Date();
    let nextPeriodDate = new Date(lastStart);
    while (nextPeriodDate <= now) {
      nextPeriodDate.setDate(nextPeriodDate.getDate() + cycleLength);
    }
    
    // 安排经期提醒
    if (settings.reminderPeriodApproaching) {
      await schedulePeriodReminder(nextPeriodDate, settings.reminderPeriodDays);
    }
    
    // 安排排卵期提醒（经期开始前14天）
    if (settings.reminderOvulation) {
      const ovulationDate = new Date(nextPeriodDate);
      ovulationDate.setDate(ovulationDate.getDate() - 14);
      await scheduleOvulationReminder(ovulationDate, 1);
    }
  }
}
