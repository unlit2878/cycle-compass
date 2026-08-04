import { describe, expect, it } from 'vitest';
import type { CycleData } from '../db';
import type { CycleModel } from '../cycle-engine';
import { buildCycleRows, buildWidgetSnapshot } from '../widget-snapshot';

const now = new Date('2026-07-26T08:00:00.000Z');

function model(overrides: Partial<CycleModel> = {}): CycleModel {
  return {
    effectiveCycleLength: 28,
    effectivePeriodLength: 5,
    currentPhase: {
      phase: 'follicular',
      dayInCycle: 8,
      daysUntilNextPeriod: 20,
      phaseDay: 3,
      phaseTotalDays: 7,
    },
    nextPeriodRange: {
      startDate: new Date('2026-08-15T12:00:00'),
      endDate: new Date('2026-08-19T12:00:00'),
      startDateStr: '2026-08-15',
      endDateStr: '2026-08-19',
    },
    ...overrides,
  } as CycleModel;
}

function cycle(startDate: string, endDate?: string): CycleData {
  return { startDate, endDate };
}

describe('buildCycleRows', () => {
  it('pairs each period with the interval that follows it', () => {
    expect(
      buildCycleRows([
        cycle('2026-04-01', '2026-04-05'),
        cycle('2026-04-29', '2026-05-02'),
        cycle('2026-05-29', '2026-06-02'),
      ])
    ).toEqual([
      { cycleLength: 28, periodLength: 5 },
      { cycleLength: 30, periodLength: 4 },
    ]);
  });

  it('sorts unordered records before pairing', () => {
    expect(
      buildCycleRows([
        cycle('2026-05-29', '2026-06-02'),
        cycle('2026-04-01', '2026-04-05'),
        cycle('2026-04-29', '2026-05-02'),
      ])
    ).toEqual([
      { cycleLength: 28, periodLength: 5 },
      { cycleLength: 30, periodLength: 4 },
    ]);
  });

  it('drops the newest record because its cycle length is not known yet', () => {
    // Three records, but the last one has no successor to measure against.
    expect(buildCycleRows([
      cycle('2026-04-01', '2026-04-05'),
      cycle('2026-04-29', '2026-05-02'),
      cycle('2026-05-29', '2026-06-02'),
    ])).toHaveLength(2);
  });

  it('skips cycles whose period was never closed', () => {
    expect(
      buildCycleRows([
        cycle('2026-04-01'),
        cycle('2026-04-29', '2026-05-02'),
        cycle('2026-05-29', '2026-06-02'),
      ])
    ).toEqual([{ cycleLength: 30, periodLength: 4 }]);
  });

  it('rejects implausible intervals rather than drawing a distorted bar', () => {
    expect(
      buildCycleRows([
        cycle('2026-01-01', '2026-01-05'),
        // 120 days later: beyond MAX_CYCLE_LENGTH.
        cycle('2026-05-01', '2026-05-04'),
        cycle('2026-05-29', '2026-06-02'),
      ])
    ).toEqual([{ cycleLength: 28, periodLength: 4 }]);
  });

  it('keeps long cycles the trends page also charts', () => {
    // A 47-day cycle is an outlier for prediction weighting but is still
    // charted by the app, so the widget must not silently drop it.
    expect(
      buildCycleRows([
        cycle('2026-01-02', '2026-01-06'),
        cycle('2026-02-18', '2026-02-23'),
        cycle('2026-03-25', '2026-03-30'),
      ])
    ).toEqual([
      { cycleLength: 47, periodLength: 5 },
      { cycleLength: 35, periodLength: 6 },
    ]);
  });

  it('rejects a period longer than the cycle containing it', () => {
    expect(
      buildCycleRows([
        cycle('2026-04-01', '2026-04-12'),
        cycle('2026-04-11', '2026-04-15'),
        cycle('2026-05-09', '2026-05-13'),
      ])
    ).toEqual([{ cycleLength: 28, periodLength: 5 }]);
  });

  it('returns nothing when there is not yet a completed cycle', () => {
    expect(buildCycleRows([])).toEqual([]);
    expect(buildCycleRows([cycle('2026-05-29', '2026-06-02')])).toEqual([]);
  });
});

describe('buildWidgetSnapshot', () => {
  it('returns an explicit empty snapshot before onboarding/data is available', () => {
    expect(buildWidgetSnapshot(null, [], now)).toEqual({
      schemaVersion: 2,
      hasData: false,
      updatedAt: '2026-07-26T08:00:00.000Z',
    });
  });

  it('contains only the fields needed by the cycle-ring widget', () => {
    expect(buildWidgetSnapshot(model(), [], now)).toEqual({
      schemaVersion: 2,
      hasData: true,
      updatedAt: '2026-07-26T08:00:00.000Z',
      phase: 'follicular',
      phaseDay: 3,
      daysUntilNextPeriod: 20,
      nextPeriodStart: '2026-08-15',
      recentCycles: [],
      averageCycleLength: undefined,
      barScale: undefined,
    });
  });

  it('widens the bar axis so a long cycle is not drawn clipped', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [
        cycle('2026-01-02', '2026-01-06'),
        // 47 days: longer than the 45-day floor.
        cycle('2026-02-18', '2026-02-23'),
        cycle('2026-03-25', '2026-03-30'),
      ],
      now
    );

    expect(snapshot.barScale).toBe(47);
  });

  it('keeps the default axis when every cycle fits inside it', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [
        cycle('2026-04-01', '2026-04-05'),
        cycle('2026-04-29', '2026-05-02'),
        cycle('2026-05-29', '2026-06-02'),
      ],
      now
    );

    expect(snapshot.barScale).toBe(45);
  });

  it('keeps only the two most recent rows, oldest first', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [
        cycle('2026-01-01', '2026-01-06'),
        cycle('2026-01-28', '2026-02-01'),
        cycle('2026-02-26', '2026-03-02'),
        cycle('2026-03-26', '2026-03-30'),
      ],
      now
    );

    expect(snapshot.recentCycles).toEqual([
      { cycleLength: 29, periodLength: 5 },
      { cycleLength: 28, periodLength: 5 },
    ]);
  });

  it('averages every usable cycle, not just the rows it draws', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [
        // 27, 33 and 28 day cycles -> mean 29, which no drawn row equals.
        cycle('2026-01-01', '2026-01-05'),
        cycle('2026-01-28', '2026-02-01'),
        cycle('2026-03-02', '2026-03-06'),
        cycle('2026-03-30', '2026-04-03'),
        cycle('2026-04-27', '2026-05-01'),
      ],
      now
    );

    expect(snapshot.averageCycleLength).toBe(29);
    expect(snapshot.recentCycles).toHaveLength(2);
  });

  it('omits the average when no cycle is complete enough to measure', () => {
    const snapshot = buildWidgetSnapshot(model(), [cycle('2026-05-29', '2026-06-02')], now);

    expect(snapshot.recentCycles).toEqual([]);
    expect(snapshot.averageCycleLength).toBeUndefined();
  });

  it('carries a single row so the widget can show its not-enough-data state', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [cycle('2026-04-29', '2026-05-02'), cycle('2026-05-29', '2026-06-02')],
      now
    );

    expect(snapshot.recentCycles).toEqual([{ cycleLength: 30, periodLength: 4 }]);
  });

  it('never leaks the dates a row was derived from', () => {
    const snapshot = buildWidgetSnapshot(
      model(),
      [
        cycle('2026-04-01', '2026-04-05'),
        cycle('2026-04-29', '2026-05-02'),
        cycle('2026-05-29', '2026-06-02'),
      ],
      now
    );

    const serialized = JSON.stringify(snapshot.recentCycles);
    expect(serialized).not.toContain('2026-04');
    expect(serialized).not.toContain('2026-05');
  });

  it('normalizes malformed countdown values at the native boundary', () => {
    const snapshot = buildWidgetSnapshot(
      model({
        effectiveCycleLength: 0,
        effectivePeriodLength: 0,
        currentPhase: {
          phase: 'menstrual',
          dayInCycle: 12,
          daysUntilNextPeriod: -2,
          phaseDay: 1,
          phaseTotalDays: 5,
        },
      }),
      [],
      now
    );

    expect(snapshot).toMatchObject({
      daysUntilNextPeriod: 0,
      phaseDay: 1,
    });
  });
});
