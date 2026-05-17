// Simplified Chinese translations for 知期

export const zh = {
  // App name
  appName: '知期',

  // Phase names
  phases: {
    menstrual: '月经期',
    follicular: '卵泡期',
    ovulation: '排卵期',
    luteal: '黄体期',
  },

  // Phase descriptions (经期用随机提示语，其他时期动态生成)
  phaseDescriptions: {
    menstrual: '注意保暖和休息',
    follicular: '精力逐渐恢复，适合开始新计划',
    ovulation: '高生育力窗口期，您可能感觉更有活力',
    luteal: '身体准备下一周期，可能会有情绪波动',
  },

  // 经期随机提示语
  menstrualTips: [
    '注意保暖和休息',
    '多喝热水，避免生冷食物',
    '适当休息，不要过度劳累',
    '注意腹部保暖',
    '保持心情愉悦',
    '可以吃些红枣、桂圆',
    '避免剧烈运动',
    '早睡早起，保证充足睡眠',
  ],

  // Phase emojis (花卉主题)
  phaseEmojis: {
    menstrual: '🌺',   // 木槿花 - 热烈
    follicular: '🌷',  // 郁金香 - 新生
    ovulation: '🌻',   // 向日葵 - 活力
    luteal: '🌼',      // 雏菊 - 平静
  },

  // Flow intensity
  flowIntensity: {
    light: '轻',
    medium: '中',
    heavy: '重',
  },

  // Symptoms
  symptoms: [
    '痛经',
    '头痛',
    '腹胀',
    '疲劳',
    '乳房胀痛',
    '腰痛',
    '痤疮',
    '恶心',
    '食欲变化',
    '失眠',
  ],

  // Moods
  moods: [
    { emoji: '😊', label: '开心' },
    { emoji: '😌', label: '平静' },
    { emoji: '😢', label: '难过' },
    { emoji: '😠', label: '烦躁' },
    { emoji: '😰', label: '焦虑' },
    { emoji: '😴', label: '疲惫' },
    { emoji: '🥰', label: '浪漫' },
    { emoji: '😐', label: '一般' },
  ],

  // Navigation
  nav: {
    home: '首页',
    calendar: '日历',
    insights: '统计',
    settings: '设置',
    log: '记录',
  },

  // Onboarding
  onboarding: {
    welcome: {
      title: '欢迎使用知期',
      subtitle: '您的私密经期追踪助手',
      description: '所有数据安全存储在您的设备上，完全私密。',
      getStarted: '开始使用',
      importData: '导入已有数据',
    },
    lastPeriodStart: {
      title: '您上次月经什么时候开始？',
      subtitle: '选择上次月经的第一天',
    },
    lastPeriodEnd: {
      title: '您上次月经什么时候结束？',
      subtitle: '（可选）这有助于更准确地预测',
      skip: '跳过此步骤',
    },
    cycleLength: {
      title: '您的月经周期通常是多少天？',
      subtitle: '从一次月经开始到下一次开始的天数',
      days: '天',
      short: '较短',
      average: '平均',
      long: '较长',
    },
    periodLength: {
      title: '您的经期通常持续多少天？',
      subtitle: '月经持续的天数',
      days: '天',
    },
    complete: '完成设置',
    next: '下一步',
    back: '返回',
  },

  // Home
  home: {
    today: '今天',
    cycleDay: '周期第 {day} 天',
    nextPeriod: '距离下次月经',
    days: '天',
    daysUntil: '天后',
    periodExpected: '预计月经期',
    weekPreview: '本周预览',
    backupReminder: '上次备份',
    daysAgo: '天前',
    backupNow: '立即备份',
    neverBackedUp: '从未备份',
  },

  // Calendar
  calendar: {
    title: '日历',
    today: '今天',
    returnToToday: '返回今天',
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    months: [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月',
    ],
    legend: '图例',
    dayDetail: {
      cycleDay: '周期第 {day} 天',
      recordedData: '已记录内容',
      period: '月经中',
      startLogging: '开始记录',
      editLog: '编辑记录',
      close: '关闭',
    },
  },

  // Logging
  logging: {
    title: '记录今天',
    titleForDate: '记录 {date}',
    isPeriod: '今天来月经了吗？',
    yes: '是',
    no: '否',
    flowIntensity: '经量',
    symptoms: '症状',
    selectSymptoms: '选择您的症状',
    mood: '心情',
    howFeeling: '今天感觉如何？',
    notes: '备注',
    notesPlaceholder: '添加任何额外的备注...',
    save: '保存记录',
    cancel: '取消',
  },

  // Insights
  insights: {
    title: '数据统计',
    overview: '概览',
    avgCycleLength: '平均周期',
    avgPeriodLength: '平均经期',
    totalCycles: '记录周期',
    days: '天',
    cycles: '个',
    cycleLengthTrend: '周期长度趋势',
    symptomFrequency: '症状频率',
    moodPatterns: '心情分布',
    noData: '暂无足够数据',
    noDataDesc: '继续记录以查看您的统计数据',
  },

  // Settings
  settings: {
    title: '设置',
    dataManagement: '数据管理',
    exportData: '导出数据',
    exporting: '导出中...',
    exportSuccess: '导出成功',
    exportDataDesc: '备份您的所有数据',
    importData: '导入数据',
    importing: '导入中...',
    importSuccess: '导入成功',
    importDataDesc: '从备份文件恢复数据',
    formatHelp: '格式说明',
    dataFormatHelp: '导入数据格式说明',
    dataFormatHelpTitle: '导入数据格式',
    dataFormatHelpDesc: '请上传 JSON 格式的备份文件',
    backupReminder: '备份提醒',
    backupReminderDesc: '定期提醒备份数据',
    weekly: '每周',
    monthly: '每月',
    never: '关闭',
    lastBackup: '上次备份',
    noBackupYet: '尚未备份',
    persistentStorage: '持久存储',
    persistentStorageDesc: '防止浏览器自动清除数据',
    persistentStorageEnabled: '已启用持久存储',
    enable: '启用',
    requestPermission: '请求权限',
    granted: '已授权',
    display: '显示设置',
    darkMode: '深色模式',
    darkModeDesc: '使用深色主题',
    about: '关于',
    aboutDesc: '一款简洁的经期追踪应用，数据安全存储在本地',
    version: '版本',
    privacy: '隐私说明',
    privacyDesc: '所有数据仅存储在您的设备上',
  },

  // Import/Export
  dataFormat: {
    title: '导入数据格式说明',
    description: '请上传 JSON 格式的备份文件，格式如下：',
    tip: '提示：最简单的方式是先导出一次数据，查看格式后再编辑。',
    requiredFields: '必填字段',
    optionalFields: '可选字段',
    example: '示例数据',
    close: '关闭',
    importSuccess: '导入成功',
    importSuccessDesc: '成功导入 {cycles} 个周期和 {logs} 条记录',
    importError: '导入失败',
    invalidFormat: '无效的 JSON 格式',
    missingFields: '缺少必填字段: {fields}',
    exportSuccess: '导出成功',
    exportSuccessDesc: '数据已保存到文件',
  },

  // Common
  common: {
    loading: '加载中...',
    error: '出错了',
    retry: '重试',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    close: '关闭',
    yes: '是',
    no: '否',
  },
};

// Date formatting helpers
export function formatDateChinese(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

export function formatMonthYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}年${month}月`;
}

export function formatShortDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

export function formatWeekday(date: Date): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[date.getDay()];
}

export function formatFullDate(date: Date): string {
  return `${formatDateChinese(date)} ${formatWeekday(date)}`;
}
