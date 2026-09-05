import { describe, it, expect } from 'vitest';
import {
  getCyclePhase,
  getCyclePhaseInfoForDate,
  getCycleDayNumberForDate,
  getOvulationDay,
  formatDate,
  parseLocalDate,
  predictNextPeriods,
} from '../cycle-utils';
import type { CycleData } from '../db';
import {
  predictNextCycle,
  extractCycleLengths,
  calculateSMA,
  calculateEWMA,
  calculateWeightedMA,
  calculateStdDev,
} from '../prediction-utils';
import { createCycleModel } from '../cycle-engine';
import type { Settings, DailyLog } from '../db';

// 辅助函数：创建日期
function createDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0);
}

// 辅助函数：创建周期数据
function createCycle(startDate: string, endDate?: string): CycleData {
  return { startDate, endDate };
}

describe('getOvulationDay', () => {
  it('应该正确计算排卵日（28天周期）', () => {
    expect(getOvulationDay(28)).toBe(14);
  });

  it('应该正确计算排卵日（30天周期）', () => {
    expect(getOvulationDay(30)).toBe(16);
  });

  it('应该正确计算排卵日（26天周期）', () => {
    expect(getOvulationDay(26)).toBe(12);
  });
});

describe('getCyclePhase', () => {
  // 28天周期，5天经期
  const cycleLength = 28;
  const periodLength = 5;

  it('应该正确识别经期（第1-5天）', () => {
    expect(getCyclePhase(1, cycleLength, periodLength)).toBe('menstrual');
    expect(getCyclePhase(3, cycleLength, periodLength)).toBe('menstrual');
    expect(getCyclePhase(5, cycleLength, periodLength)).toBe('menstrual');
  });

  it('应该正确识别卵泡期（第6-11天）', () => {
    expect(getCyclePhase(6, cycleLength, periodLength)).toBe('follicular');
    expect(getCyclePhase(8, cycleLength, periodLength)).toBe('follicular');
    expect(getCyclePhase(11, cycleLength, periodLength)).toBe('follicular');
  });

  it('应该正确识别排卵期（第12-16天）', () => {
    expect(getCyclePhase(12, cycleLength, periodLength)).toBe('ovulation');
    expect(getCyclePhase(14, cycleLength, periodLength)).toBe('ovulation');
    expect(getCyclePhase(16, cycleLength, periodLength)).toBe('ovulation');
  });

  it('应该正确识别黄体期（第17-28天）', () => {
    expect(getCyclePhase(17, cycleLength, periodLength)).toBe('luteal');
    expect(getCyclePhase(20, cycleLength, periodLength)).toBe('luteal');
    expect(getCyclePhase(28, cycleLength, periodLength)).toBe('luteal');
  });

  it('应该处理不同的经期长度', () => {
    // 7天经期
    expect(getCyclePhase(7, 28, 7)).toBe('menstrual');
    expect(getCyclePhase(8, 28, 7)).toBe('follicular');
  });

  it('应该处理不同的周期长度', () => {
    // 30天周期，排卵日 = 30 - 14 = 16
    // 排卵期 = 16 ± 2 = 14-18天
    expect(getCyclePhase(1, 30, 5)).toBe('menstrual');
    expect(getCyclePhase(6, 30, 5)).toBe('follicular');
    expect(getCyclePhase(14, 30, 5)).toBe('ovulation');
    expect(getCyclePhase(18, 30, 5)).toBe('ovulation'); // 第18天仍在排卵期内
    expect(getCyclePhase(19, 30, 5)).toBe('luteal');    // 第19天开始黄体期
  });
});

describe('getCycleDayNumberForDate', () => {
  const cycles = [
    createCycle('2026-01-01', '2026-01-05'),
    createCycle('2026-02-05', '2026-02-09'),
  ];

  it('历史周期按相邻两次经期首日统计实际天数', () => {
    expect(getCycleDayNumberForDate(createDate(2026, 1, 1), { cycles, cycleLength: 28 })).toBe(1);
    expect(getCycleDayNumberForDate(createDate(2026, 2, 4), { cycles, cycleLength: 28 })).toBe(35);
    expect(getCycleDayNumberForDate(createDate(2026, 2, 5), { cycles, cycleLength: 28 })).toBe(1);
  });

  it('最近一次经期之后按趋势预测的有效周期长度重置', () => {
    expect(getCycleDayNumberForDate(createDate(2026, 3, 4), { cycles, cycleLength: 28 })).toBe(28);
    expect(getCycleDayNumberForDate(createDate(2026, 3, 5), { cycles, cycleLength: 28 })).toBe(1);
    expect(getCycleDayNumberForDate(createDate(2026, 3, 6), { cycles, cycleLength: 28 })).toBe(2);
  });

  it('只有设置中的最近经期首日时也能统计，之前的日期不显示', () => {
    const options = { cycles: [], lastPeriodStart: '2026-05-18', cycleLength: 30 };
    expect(getCycleDayNumberForDate(createDate(2026, 5, 17), options)).toBeNull();
    expect(getCycleDayNumberForDate(createDate(2026, 5, 18), options)).toBe(1);
    expect(getCycleDayNumberForDate(createDate(2026, 6, 17), options)).toBe(1);
  });
});

describe('getCyclePhaseInfoForDate', () => {
  describe('基本场景：正常周期', () => {
    it('应该正确计算记录经期内的日期', () => {
      const cycles = [
        createCycle('2026-05-12', '2026-05-16'),
        createCycle('2026-06-14', '2026-06-19'),
      ];

      const result = getCyclePhaseInfoForDate(
        createDate(2026, 6, 15),
        {
          cycles,
          lastPeriodStart: '2026-06-14',
          cycleLength: 28,
          periodLength: 5,
        }
      );

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('menstrual');
      expect(result!.isRecordedPeriod).toBe(true);
    });

    it('应该正确计算预测经期内的日期', () => {
      const cycles = [createCycle('2026-05-12', '2026-05-16')];
      const predictedPeriodDateSet = new Set<string>();
      // 预测6月9-13日为经期
      for (let i = 9; i <= 13; i++) {
        predictedPeriodDateSet.add(`2026-06-${i.toString().padStart(2, '0')}`);
      }

      const result = getCyclePhaseInfoForDate(
        createDate(2026, 6, 10),
        {
          cycles,
          lastPeriodStart: '2026-05-12',
          cycleLength: 28,
          periodLength: 5,
          predictedPeriodDateSet,
        }
      );

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('menstrual');
      expect(result!.isPredictedPeriod).toBe(true);
    });
  });

  describe('经期延迟场景（用户报告的 bug）', () => {
    it('当经期延迟时，预期经期的日子应该保持为 luteal 而不是变成 follicular', () => {
      // 场景：
      // - 上一次经期：5月12-16日
      // - 预计下次经期：6月9-13日（28天周期）
      // - 实际经期：6月14-19日（延迟了）
      // - 问题：6月9-13日被错误地显示为卵泡期

      const cycles = [
        createCycle('2026-05-12', '2026-05-16'),
        createCycle('2026-06-14', '2026-06-19'),
      ];

      // 注意：当记录了6月14日的经期后，predictedPeriodDateSet会基于6月14日重新计算
      // 所以6月9-13日不在预测集合中
      const predictedPeriodDateSet = new Set<string>();
      // 7月12-16日是基于6月14日的下一个预测
      for (let i = 12; i <= 16; i++) {
        predictedPeriodDateSet.add(`2026-07-${i.toString().padStart(2, '0')}`);
      }

      // 测试6月9日（预期经期第一天）
      const resultJune9 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 9),
        {
          cycles,
          lastPeriodStart: '2026-06-14',
          cycleLength: 28,
          periodLength: 5,
          predictedPeriodDateSet,
        }
      );

      // 6月9日应该在预期经期范围内，所以应该是 luteal（黄体期，等待经期到来）
      expect(resultJune9).not.toBeNull();
      expect(resultJune9!.phase).toBe('luteal');

      // 测试6月13日（预期经期最后一天）
      const resultJune13 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 13),
        {
          cycles,
          lastPeriodStart: '2026-06-14',
          cycleLength: 28,
          periodLength: 5,
          predictedPeriodDateSet,
        }
      );

      expect(resultJune13).not.toBeNull();
      expect(resultJune13!.phase).toBe('luteal');
    });

    it('应该正确显示完整的经期延迟场景', () => {
      const cycles = [
        createCycle('2026-05-12', '2026-05-16'),
        createCycle('2026-06-14', '2026-06-19'),
      ];

      const predictedPeriodDateSet = new Set<string>();
      for (let i = 12; i <= 16; i++) {
        predictedPeriodDateSet.add(`2026-07-${i.toString().padStart(2, '0')}`);
      }

      const options = {
        cycles,
        lastPeriodStart: '2026-06-14',
        cycleLength: 28,
        periodLength: 5,
        predictedPeriodDateSet,
      };

      // 测试6月各日期的阶段
      // lastPeriodStart = 2026-06-14
      // 6月1日距离6月14日 = -13天，取模后 = 15天，dayInCurrentCycle = 16，luteal
      // 6月8日距离6月14日 = -6天，取模后 = 22天，dayInCurrentCycle = 23，luteal
      // 6月9日距离6月14日 = -5天，取模后 = 23天，dayInCurrentCycle = 24，但应该在预期经期范围内，保持 luteal
      // 6月14日是记录的经期
      // 6月20日距离6月14日 = 6天，dayInCurrentCycle = 7，follicular
      // 6月30日距离6月14日 = 16天，dayInCurrentCycle = 17，luteal
      const testCases = [
        { date: createDate(2026, 6, 1), expectedPhase: 'luteal', desc: '6月1日应该是黄体期' },
        { date: createDate(2026, 6, 8), expectedPhase: 'luteal', desc: '6月8日应该是黄体期' },
        { date: createDate(2026, 6, 9), expectedPhase: 'luteal', desc: '6月9日经期延迟，保持黄体期' },
        { date: createDate(2026, 6, 13), expectedPhase: 'luteal', desc: '6月13日经期延迟，保持黄体期' },
        { date: createDate(2026, 6, 14), expectedPhase: 'menstrual', desc: '6月14日是实际记录的经期' },
        { date: createDate(2026, 6, 19), expectedPhase: 'menstrual', desc: '6月19日是实际记录的经期' },
        { date: createDate(2026, 6, 20), expectedPhase: 'follicular', desc: '6月20日应该是卵泡期' },
        { date: createDate(2026, 6, 30), expectedPhase: 'luteal', desc: '6月30日应该是黄体期（距离上次经期16天）' },
      ];

      testCases.forEach(({ date, expectedPhase, desc }) => {
        const result = getCyclePhaseInfoForDate(date, options);
        expect(result).not.toBeNull();
        expect(result!.phase).toBe(expectedPhase);
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理没有记录周期的情况', () => {
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 6, 15),
        {
          cycles: [],
          lastPeriodStart: '2026-05-12',
          cycleLength: 28,
          periodLength: 5,
        }
      );

      expect(result).not.toBeNull();
      // 6月15日距离5月12日是34天，取模后是34 % 28 = 6天，dayInCurrentCycle = 7
      // getCyclePhase(7, 28, 5) = follicular
      expect(result!.phase).toBe('follicular');
    });

    it('应该处理 lastPeriodStart 为空的情况', () => {
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 6, 15),
        {
          cycles: [],
          cycleLength: 28,
          periodLength: 5,
        }
      );

      expect(result).toBeNull();
    });

    it('应该处理周期长度为1的极端情况', () => {
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 6, 15),
        {
          cycles: [createCycle('2026-06-10')],
          lastPeriodStart: '2026-06-10',
          cycleLength: 1,
          periodLength: 1,
        }
      );

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('menstrual');
    });
  });

  describe('多次周期延迟场景', () => {
    it('应该正确处理连续两次周期延迟', () => {
      // 场景：
      // - 第一次经期：4月14-18日
      // - 第二次经期：5月16-20日（延迟2天）
      // - 第三次经期：6月18-22日（又延迟2天）

      const cycles = [
        createCycle('2026-04-14', '2026-04-18'),
        createCycle('2026-05-16', '2026-05-20'),
        createCycle('2026-06-18', '2026-06-22'),
      ];

      const predictedPeriodDateSet = new Set<string>();
      // 预测下一次经期：7月20-24日
      for (let i = 20; i <= 24; i++) {
        predictedPeriodDateSet.add(`2026-07-${i.toString().padStart(2, '0')}`);
      }

      const options = {
        cycles,
        lastPeriodStart: '2026-06-18',
        cycleLength: 32, // 平均周期长度
        periodLength: 5,
        predictedPeriodDateSet,
      };

      // 6月15日距离6月18日 = -3天，取模后 = 29天，dayInCurrentCycle = 30
      // getCyclePhase(30, 32, 5) = luteal
      const resultJune15 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 15),
        options
      );

      expect(resultJune15).not.toBeNull();
      // 6月15日不在预期经期范围内（预期经期是 cycleLength=32 天后）
      expect(resultJune15!.phase).toBe('luteal');
    });
  });

  describe('不同周期长度的场景', () => {
    it('应该正确处理26天的短周期', () => {
      const cycles = [
        createCycle('2026-05-01', '2026-05-05'),
        createCycle('2026-05-27', '2026-05-31'),
      ];

      const predictedPeriodDateSet = new Set<string>();
      for (let i = 22; i <= 26; i++) {
        predictedPeriodDateSet.add(`2026-06-${i.toString().padStart(2, '0')}`);
      }

      const options = {
        cycles,
        lastPeriodStart: '2026-05-27',
        cycleLength: 26,
        periodLength: 5,
        predictedPeriodDateSet,
      };

      // 测试5月27日
      const resultMay27 = getCyclePhaseInfoForDate(
        createDate(2026, 5, 27),
        options
      );
      expect(resultMay27).not.toBeNull();
      expect(resultMay27!.phase).toBe('menstrual');
      expect(resultMay27!.isRecordedPeriod).toBe(true);

      // 测试6月22日（预测经期）
      const resultJune22 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 22),
        options
      );
      expect(resultJune22).not.toBeNull();
      expect(resultJune22!.phase).toBe('menstrual');
      expect(resultJune22!.isPredictedPeriod).toBe(true);
    });

    it('应该正确处理32天的长周期', () => {
      const cycles = [
        createCycle('2026-04-01', '2026-04-06'),
        createCycle('2026-05-03', '2026-05-08'),
      ];

      const options = {
        cycles,
        lastPeriodStart: '2026-05-03',
        cycleLength: 32,
        periodLength: 5,
      };

      // 测试5月3日（记录的经期）
      const resultMay3 = getCyclePhaseInfoForDate(
        createDate(2026, 5, 3),
        options
      );
      expect(resultMay3).not.toBeNull();
      expect(resultMay3!.phase).toBe('menstrual');

      // 测试6月4日（应该是下一个周期的第33天，取模后是1天）
      const resultJune4 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 4),
        options
      );
      expect(resultJune4).not.toBeNull();
      // 6月4日距离5月3日是32天，计算出来是 menstrual，但没有记录经期
      // 在预期经期范围内，所以保持为 luteal（等待经期到来）
      expect(resultJune4!.phase).toBe('luteal');
    });
  });

  describe('边界容差测试', () => {
    it('应该允许3天的容差范围', () => {
      const cycles = [
        createCycle('2026-05-12', '2026-05-16'),
        createCycle('2026-06-14', '2026-06-19'),
      ];

      const options = {
        cycles,
        lastPeriodStart: '2026-06-14',
        cycleLength: 28,
        periodLength: 5,
      };

      // 测试6月6日（在容差范围内）
      const resultJune6 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 6),
        options
      );
      expect(resultJune6).not.toBeNull();
      // 6月6日距离5月12日是25天，取模后是25+1=26天，应该是luteal
      expect(resultJune6!.phase).toBe('luteal');

      // 测试6月7日（在容差范围内，但计算出来是luteal）
      const resultJune7 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 7),
        options
      );
      expect(resultJune7).not.toBeNull();
      expect(resultJune7!.phase).toBe('luteal');

      // 测试6月8日（在容差范围内）
      const resultJune8 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 8),
        options
      );
      expect(resultJune8).not.toBeNull();
      expect(resultJune8!.phase).toBe('luteal');

      // 测试6月9日（在预期经期范围内，经期延迟，保持黄体期）
      const resultJune9 = getCyclePhaseInfoForDate(
        createDate(2026, 6, 9),
        options
      );
      expect(resultJune9).not.toBeNull();
      expect(resultJune9!.phase).toBe('luteal');
    });
  });
});

describe('formatDate', () => {
  it('应该正确格式化日期', () => {
    const date = new Date(2026, 5, 15, 12, 0, 0); // 6月15日
    expect(formatDate(date)).toBe('2026-06-15');
  });

  it('应该处理个位数日期', () => {
    const date = new Date(2026, 0, 5, 12, 0, 0); // 1月5日
    expect(formatDate(date)).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('应该正确解析日期字符串', () => {
    const date = parseLocalDate('2026-06-15');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(5); // 6月是5
    expect(date.getDate()).toBe(15);
  });

  it('应该处理闰年日期', () => {
    const date = parseLocalDate('2024-02-29');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(1); // 2月是1
    expect(date.getDate()).toBe(29);
  });
});

describe('不规律经期场景：预计5月3日但实际5月17日', () => {
  // 场景：用户有3次不规律的经期记录
  // - 第1次：2月1日-2月6日（6天）
  // - 第2次：3月5日-3月9日（5天），与第1次间隔 = 32天
  // - 第3次：4月2日-4月8日（7天），与第2次间隔 = 28天
  // - 预计第4次：5月2日左右（基于平均周期30天预测）
  // - 实际第4次：5月3日-5月9日（与第3次间隔 = 31天），延迟约1天
  //
  // 使用 prediction-utils 的 extractCycleLengths + predictNextCycle 进行验证

  const cycles: CycleData[] = [
    createCycle('2026-02-01', '2026-02-06'),
    createCycle('2026-03-05', '2026-03-09'),
    createCycle('2026-04-02', '2026-04-08'),
  ];

  // 包含实际第4次经期的记录
  const cyclesWithActual: CycleData[] = [
    ...cycles,
    createCycle('2026-05-03', '2026-05-09'),
  ];

  describe('extractCycleLengths 提取周期长度', () => {
    it('应该正确提取不规律周期的间隔（N个周期产生N-1个间隔）', () => {
      // 3个周期 → 2个间隔：2月1日→3月5日=32天, 3月5日→4月2日=28天
      const extracted = extractCycleLengths(cycles);
      expect(extracted).toHaveLength(2);
      expect(extracted[0].length).toBe(32);
      expect(extracted[1].length).toBe(28);
    });

    it('4个周期应该提取3个间隔', () => {
      const extracted = extractCycleLengths(cyclesWithActual);
      expect(extracted).toHaveLength(3);
      expect(extracted[0].length).toBe(32); // 2月1日→3月5日
      expect(extracted[1].length).toBe(28); // 3月5日→4月2日
      expect(extracted[2].length).toBe(31); // 4月2日→5月3日
      expect(extracted.every(d => !d.isOutlier)).toBe(true);
    });

    it('应该忽略无效的周期数据', () => {
      const cyclesWithInvalid = [
        createCycle('2026-02-01', '2026-02-06'),
        createCycle('2026-03-05'), // 无 endDate
        createCycle('2026-04-02', '2026-04-08'),
      ];
      // 无 endDate 的周期仍可计算间隔（基于 startDate）
      const extracted = extractCycleLengths(cyclesWithInvalid);
      expect(extracted).toHaveLength(2);
      expect(extracted[0].length).toBe(32);
      expect(extracted[1].length).toBe(28);
    });
  });

  describe('predictNextCycle 预测引擎', () => {
    it('3次不规律周期应该使用SMA方法（stdDev ≤ 2）', () => {
      const prediction = predictNextCycle(cycles);
      // lengths = [32, 28, 30], stdDev ≈ 1.63 ≤ 2 → SMA
      expect(prediction.method).toBe('sma');
    });

    it('预测周期长度应为30天（SMA窗口=3，取最近3个值的平均）', () => {
      const prediction = predictNextCycle(cycles);
      // SMA(3) of [32, 28, 30] = Math.round((32+28+30)/3) = 30
      expect(prediction.predictedCycleLength).toBe(30);
    });

    it('置信度应在合理范围内', () => {
      const prediction = predictNextCycle(cycles);
      expect(prediction.confidence).toBeGreaterThanOrEqual(0.25);
      expect(prediction.confidence).toBeLessThanOrEqual(0.9);
      // 3个周期产生2个间隔 → sampleSize = 2
      expect(prediction.sampleSize).toBe(2);
    });

    it('预测窗口应包含合理范围', () => {
      const prediction = predictNextCycle(cycles);
      expect(prediction.lowerBound).toBeLessThanOrEqual(prediction.predictedCycleLength);
      expect(prediction.upperBound).toBeGreaterThanOrEqual(prediction.predictedCycleLength);
      expect(prediction.lowerBound).toBeGreaterThanOrEqual(18); // MIN_REASONABLE_CYCLE
    });

    it('加入第4次周期后预测应更新', () => {
      const prediction = predictNextCycle(cyclesWithActual);
      // 4个周期产生3个间隔 [32, 28, 31], SMA(3) = Math.round((32+28+31)/3) = 30
      expect(prediction.predictedCycleLength).toBe(30);
      expect(prediction.sampleSize).toBe(3);
    });
  });

  describe('经期延迟检测（仅3次记录，无predictedPeriodDateSet）', () => {
    // 场景：只有3次记录，lastPeriodStart = 4月2日
    // 预测下次经期 = 4月2日 + 30天 = 5月2日
    // 5月3日-7日处于预期经期范围内，但实际未记录
    // getCyclePhaseInfoForDate 的延迟检测应将这些日期标记为 luteal

    it('5月3日（预期经期第1天）应该是 luteal（延迟等待）', () => {
      // dayDiff=31, dayInCurrentCycle=2, getCyclePhase(2,30,6)=menstrual
      // anchorCycle.endDate=4月8日, 5月3日>4月8日, dayDiff=31 < safeCycleLength=30
      // 延迟检测：31 >= 27 && 31 <= 36 → luteal
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 3),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('luteal');
    });

    it('5月7日（预期经期范围内）应该是 luteal（延迟等待）', () => {
      // dayDiff=35, dayInCurrentCycle=6, getCyclePhase(6,30,6)=menstrual
      // 延迟检测：35 >= 27 && 35 <= 36 → luteal
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 7),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('luteal');
    });

    it('5月8日（预期经期末尾）应该是 follicular', () => {
      // dayDiff=36, dayInCurrentCycle=((36%30)+30)%30+1=7
      // getCyclePhase(7, 30, 6): 7 > 6 → follicular
      // phase 不是 menstrual，不进入延迟检测逻辑
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 8),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('follicular');
    });

    it('5月9日（超出预期经期范围）应该是 follicular', () => {
      // dayDiff=37, dayInCurrentCycle=8, getCyclePhase(8,30,6)=follicular
      // 不进入延迟检测（phase !== 'menstrual'）
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 9),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('follicular');
    });

    it('5月10日（预期经期之后）应该是 follicular', () => {
      // dayDiff=38, dayInCurrentCycle=9 → follicular
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 10),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('follicular');
    });

    it('5月15日（延迟12天）应该是 ovulation', () => {
      // dayDiff=43, dayInCurrentCycle=14, ovulationDay=16, 14 >= 14 → ovulation
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 15),
        { cycles, lastPeriodStart: '2026-04-02', cycleLength: 30, periodLength: 6 }
      );
      expect(result).not.toBeNull();
      expect(result!.phase).toBe('ovulation');
    });
  });

  describe('createCycleModel 预测引擎集成', () => {
    function createTestSettings(overrides: Partial<Settings> = {}): Settings {
      return {
        id: 1,
        onboardingComplete: true,
        averageCycleLength: 28,
        averagePeriodLength: 5,
        reminderPeriodApproaching: false,
        reminderPeriodDays: 2,
        reminderOvulation: false,
        reminderDailyLog: false,
        darkMode: false,
        backupReminderInterval: 'monthly',
        persistentStorageGranted: false,
        ...overrides,
      };
    }

    it('3次周期记录应正确计算预测模型', () => {
      const model = createCycleModel(createTestSettings(), cycles, [], createDate(2026, 5, 1));

      expect(model.effectiveCycleLength).toBe(30);
      expect(model.effectivePeriodLength).toBe(6);
      expect(model.cycleLength.source).toBe('history');
      // 3个周期 → 2个间隔 → sampleSize = 2
      expect(model.cycleLength.sampleSize).toBe(2);
      expect(model.lastPeriodStartDateStr).toBe('2026-04-02');
    });

    it('3次记录的模型应在5月3日显示 luteal（predictedPeriodDateSet 不含当前周期）', () => {
      // buildPredictedPeriodDateSet 从 lastPeriodStart=4月2日 开始，
      // 循环推进到超过 today=5月3日 → 6月1日为第一个预测起点
      // 5月3日不在 predictedPeriodDateSet 中 → 延迟检测 → luteal
      const model = createCycleModel(createTestSettings(), cycles, [], createDate(2026, 5, 3));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('luteal');
    });

    it('3次记录的模型应在5月10日显示 follicular（预测经期后、新周期进行中）', () => {
      // dayDiff=38, dayInCurrentCycle=((38%30)+30)%30+1=9
      // getCyclePhase(9, 30, 6) = follicular（9 > 6，不在排卵期 14-18 范围内）
      // 不进入延迟检测（phase !== 'menstrual'）
      const model = createCycleModel(createTestSettings(), cycles, [], createDate(2026, 5, 10));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('follicular');
    });

    it('3次记录的模型应在6月1日显示 follicular（预期经期窗口外）', () => {
      // buildPredictedPeriodDateSet 推进到 7月1日（6月1日 <= today 导致多推进一轮）
      // 6月1日不在 predictedPeriodDateSet 中
      // dayDiff=60, 延迟检测: 60 不在 27-35 范围 → else 分支 → follicular
      const model = createCycleModel(createTestSettings(), cycles, [], createDate(2026, 6, 1));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('follicular');
    });

    it('加入第4次周期后预测应更新', () => {
      const model = createCycleModel(createTestSettings(), cyclesWithActual, [], createDate(2026, 5, 15));

      // 4个周期 → 3个间隔 [32, 28, 31], SMA(3) = 30
      expect(model.effectiveCycleLength).toBe(30);
      expect(model.cycleLength.sampleSize).toBe(3);
      expect(model.lastPeriodStartDateStr).toBe('2026-05-03');
    });

    it('第4次经期记录后，5月3日应显示为 recorded menstrual', () => {
      const model = createCycleModel(createTestSettings(), cyclesWithActual, [], createDate(2026, 5, 3));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('menstrual');
      expect(model.currentPhase!.isRecordedPeriod).toBe(true);
    });

    it('第4次经期记录后，下一个预测经期应基于5月3日计算', () => {
      // nextPeriodRange 从 lastPeriodStart=5月3日 + cycleLength=30 开始
      // 5月3日 + 30 = 6月2日（> today=5月15日），所以 nextPeriodRange 从6月2日开始
      const model = createCycleModel(createTestSettings(), cyclesWithActual, [], createDate(2026, 5, 15));

      expect(model.nextPeriodRange).not.toBeNull();
      expect(model.nextPeriodRange!.startDateStr).toBe('2026-06-02');
    });

    it('第4次经期记录后，6月1日应显示为 luteal（predictedPeriodDateSet 从6月2日开始）', () => {
      // buildPredictedPeriodDateSet 从 5月3日 推进到 6月2日（>6月1日 today）
      // 6月1日不在 predictedPeriodDateSet 中 → luteal
      const model = createCycleModel(createTestSettings(), cyclesWithActual, [], createDate(2026, 6, 1));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('luteal');
    });

    it('第4次经期记录后，6月2日应显示为 luteal（预期经期等待中）', () => {
      // 6月2日 = lastPeriodStart(5月3日) + cycleLength(30)
      // buildPredictedPeriodDateSet 推进到 7月2日（6月2日 <= today 导致多推进一轮）
      // 6月2日不在 predictedPeriodDateSet 中
      // dayDiff=30, 延迟检测: 30 在 27-35 范围 → luteal（等待经期到来）
      const model = createCycleModel(createTestSettings(), cyclesWithActual, [], createDate(2026, 6, 2));

      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('luteal');
    });

    it('周期规律性评分应反映不规律程度', () => {
      const model = createCycleModel(createTestSettings(), cycles, [], createDate(2026, 5, 1));

      expect(model.analytics.regularity).not.toBeNull();
      // 3个周期 → 2个间隔 → sampleSize = 2
      expect(model.analytics.regularity!.sampleSize).toBe(2);
      expect(model.analytics.regularity!.cv).toBeGreaterThan(0);
    });
  });

  describe('daysUntilNextPeriod 验证', () => {
    it('经期第1天应该是完整的周期长度', () => {
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 3),
        {
          cycles: cyclesWithActual,
          lastPeriodStart: '2026-05-03',
          cycleLength: 30,
          periodLength: 6,
        }
      );
      expect(result).not.toBeNull();
      expect(result!.daysUntilNextPeriod).toBe(30);
    });

    it('周期中间应该递减', () => {
      const result = getCyclePhaseInfoForDate(
        createDate(2026, 5, 18),
        {
          cycles: cyclesWithActual,
          lastPeriodStart: '2026-05-03',
          cycleLength: 30,
          periodLength: 6,
        }
      );
      expect(result).not.toBeNull();
      // 5月18日距离5月3日 = 15天，dayInCurrentCycle = 16
      // daysUntilNextPeriod = 30 - 16 + 1 = 15
      expect(result!.daysUntilNextPeriod).toBe(15);
    });
  });
});

describe('经期延迟 bug（真实场景：预计 8/31 未到，今天 9/4）', () => {
  // 锚定周期 7/23–7/29（7 天经期），有效周期 39 天。
  // 今天 9/4 距锚点 43 天：预计经期 8/31 已过 4 天仍未记录 → 延迟中。
  const anchorCycles: CycleData[] = [createCycle('2026-07-23', '2026-07-29')];

  function delayedSettings(): Settings {
    return {
      id: 1,
      onboardingComplete: true,
      averageCycleLength: 39,
      averagePeriodLength: 7,
      reminderPeriodApproaching: false,
      reminderPeriodDays: 2,
      reminderOvulation: false,
      reminderDailyLog: false,
      darkMode: false,
      backupReminderInterval: 'monthly',
      persistentStorageGranted: false,
      lastPeriodStart: '2026-07-23',
    };
  }

  describe('黄体期天数：延迟中应继续累加，而不是重置为第 1 天', () => {
    it('9/4（晚 4 天）应为黄体期，且 phaseDay 从真实 dayInCycle 继续（=17），不是 1', () => {
      const result = getCyclePhaseInfoForDate(createDate(2026, 9, 4), {
        cycles: anchorCycles,
        lastPeriodStart: '2026-07-23',
        cycleLength: 39,
        periodLength: 7,
      });

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('luteal');
      // dayInCycle = 43 + 1 = 44；排卵日 = round(39-14) = 25；黄体期天数 = 44 - (25 + 2) = 17
      expect(result!.phaseDay).toBe(17);
      expect(result!.phaseDay).not.toBe(1);
    });

    it('未延迟的正常黄体期仍用取模后的当前周期天数（回归保护）', () => {
      // 8/22 距锚点 30 天，仍在第一个周期内（未延迟）：dayInCurrentCycle = 31 → 黄体期第 4 天
      const result = getCyclePhaseInfoForDate(createDate(2026, 8, 22), {
        cycles: anchorCycles,
        lastPeriodStart: '2026-07-23',
        cycleLength: 39,
        periodLength: 7,
      });

      expect(result).not.toBeNull();
      expect(result!.phase).toBe('luteal');
      expect(result!.phaseDay).toBe(4);
    });
  });

  describe('日历：逾期的预期经期窗口应保留，且不被未来预测吞掉', () => {
    it('overduePeriodDateSet 覆盖 8/31–9/06；predictedPeriodDateSet 从 10/09 开始且不含 8/31', () => {
      const model = createCycleModel(delayedSettings(), anchorCycles, [], createDate(2026, 9, 4));

      expect(model.effectiveCycleLength).toBe(39);
      expect(model.effectivePeriodLength).toBe(7);

      // 逾期窗口保留 → 日历据此画出"逾期未到"标记
      expect(model.overduePeriodDateSet.has('2026-08-31')).toBe(true);
      expect(model.overduePeriodDateSet.has('2026-09-06')).toBe(true);
      expect(model.overduePeriodDateSet.size).toBe(7);

      // 未来预测集合不再吞掉 8/31
      expect(model.predictedPeriodDateSet.has('2026-08-31')).toBe(false);
      expect(model.predictedPeriodDateSet.has('2026-10-09')).toBe(true);

      // 首页相位：黄体期，且天数继续累加（非第 1 天）
      expect(model.currentPhase).not.toBeNull();
      expect(model.currentPhase!.phase).toBe('luteal');
      expect(model.currentPhase!.phaseDay).toBe(17);
    });

    it('补记了迟到的经期后逾期窗口清空（锚点前移，回归正常）', () => {
      // 用户在 9/6 记录了经期 → 锚点移到 9/6，getMostRecentExpectedStart 返回 null
      const withRecorded: CycleData[] = [
        createCycle('2026-07-23', '2026-07-29'),
        createCycle('2026-09-06', '2026-09-11'),
      ];
      const model = createCycleModel(delayedSettings(), withRecorded, [], createDate(2026, 9, 7));

      expect(model.overduePeriodDateSet.size).toBe(0);
    });
  });
});
