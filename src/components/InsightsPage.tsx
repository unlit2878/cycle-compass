import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarDays,
  Heart,
  Info,
  Leaf,
  ListFilter,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { PageShell } from '@/components/AppScaffold';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CycleAnalytics, CycleModel, MetricConfidence } from '@/lib/cycle-engine';
import { CycleData, DailyLog, Settings } from '@/lib/db';
import { formatDateCN } from '@/lib/ui-model';
import {
  calculateStdDev,
  evaluatePredictionAccuracy,
  extractCycleLengths,
  getMethodName,
  predictNextCycle,
  PredictionResult,
} from '@/lib/prediction-utils';
import { parseLocalDate } from '@/lib/cycle-utils';

interface InsightsPageProps {
  settings: Settings | null;
  cycles: CycleData[];
  dailyLogs: DailyLog[];
  statistics: CycleAnalytics;
  cycleModel: CycleModel | null;
}

type TimeRange = 'recent6' | 'recent12' | 'year' | 'all';

interface RangeStats {
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  totalCyclesTracked: number;
  cycleLengthRange: { min: number; max: number } | null;
  periodLengthRange: { min: number; max: number; avg: number } | null;
  regularity: {
    score: number | null;
    mean: number;
    min: number;
    max: number;
    variation: number;
    stdDev: number;
    cv: number;
    sampleSize: number;
    confidence: MetricConfidence;
    lengths: number[];
  } | null;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const FIGO_MIN_CYCLE = 24;
const FIGO_MAX_CYCLE = 38;
const FIGO_MAX_VARIATION = 9;
const FIGO_MAX_PERIOD = 8;

export function InsightsPage({ cycles }: InsightsPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('recent6');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const years = useMemo(() => getAvailableYears(cycles), [cycles]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const activeYear = selectedYear ?? years[0] ?? new Date().getFullYear();

  const allStats = useMemo(() => buildRangeStats(cycles), [cycles]);
  const filteredCycles = useMemo(
    () => filterCycles(cycles, timeRange, activeYear),
    [activeYear, cycles, timeRange]
  );
  const chartStats = useMemo(() => buildRangeStats(filteredCycles), [filteredCycles]);
  const chartRows = useMemo(() => buildChartRows(filteredCycles, chartStats), [filteredCycles, chartStats]);
  const prediction = useMemo(
    () => (extractCycleLengths(cycles).length > 0 ? predictNextCycle(cycles) : null),
    [cycles]
  );
  const predictionAccuracy = useMemo(() => evaluatePredictionAccuracy(cycles), [cycles]);
  const recentPredictions = predictionAccuracy.predictions.slice(-6).reverse();
  const healthMessages = getHealthMessages(allStats);
  const hasCycles = cycles.length > 0;

  return (
    <PageShell
      title="趋势"
      subtitle="了解身体的变化，掌握周期规律"
      decor="insights"
      className="insights-screen"
    >
      {!hasCycles ? (
        <section className="analysis-section">
          <div className="empty-state">还没有可分析的周期记录。继续记录经期开始和结束后，这里会显示真实趋势。</div>
        </section>
      ) : (
        <>
          <section className="insight-stat-row">
            <StatItem
              icon={CalendarDays}
              label="平均周期"
              value={formatStatValue(allStats.averageCycleLength)}
              unit={allStats.averageCycleLength === null ? '' : '天'}
              desc={formatCycleRange(allStats.cycleLengthRange)}
              tone="pink"
            />
            <StatItem
              icon={Activity}
              label="平均经期"
              value={formatStatValue(allStats.averagePeriodLength)}
              unit={allStats.averagePeriodLength === null ? '' : '天'}
              desc={formatPeriodRange(allStats.periodLengthRange)}
              tone="red"
            />
            <StatItem
              icon={TrendingUp}
              label="记录周期"
              value={allStats.totalCyclesTracked}
              unit="个"
              desc="全部周期"
              tone="orange"
            />
            <StatItem
              icon={Heart}
              label="规律评分"
              value={formatStatValue(allStats.regularity?.score ?? null)}
              unit={allStats.regularity?.score === null || !allStats.regularity ? '' : '分'}
              desc={allStats.regularity ? `${allStats.regularity.sampleSize} 个有效周期` : '记录不足'}
              tone="green"
              score={allStats.regularity?.score ?? null}
            />
          </section>

          <section className="analysis-section">
            <div className="analysis-heading-row">
              <h2>
                <Target className="h-5 w-5 text-[#f06c86]" />
                周期与经期时长分析
              </h2>
              <button
                type="button"
                className={`analysis-filter-button ${filtersOpen ? 'active' : ''}`}
                aria-label="筛选周期与经期时长分析"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <ListFilter className="h-4 w-4" />
              </button>
            </div>

            {filtersOpen && (
              <section className="insights-range-panel" aria-label="周期与经期时长分析筛选">
                <div className="insights-range-tabs">
                  {[
                    { value: 'recent6', label: '最近 6' },
                    { value: 'recent12', label: '最近 12' },
                    { value: 'year', label: '按年份' },
                    { value: 'all', label: '全部' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      className={timeRange === item.value ? 'active' : undefined}
                      onClick={() => setTimeRange(item.value as TimeRange)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {timeRange === 'year' && (
                  <div className="insights-year-rail" aria-label="年份筛选">
                    {years.length > 0 ? (
                      years.map((year) => (
                        <button
                          type="button"
                          key={year}
                          className={activeYear === year ? 'active' : undefined}
                          onClick={() => setSelectedYear(year)}
                        >
                          {year}
                        </button>
                      ))
                    ) : (
                      <span>暂无年份</span>
                    )}
                  </div>
                )}
              </section>
            )}
            <div className="chart-legend">
              <span><i className="pink" />经期天数</span>
              <span><i className="green-line" />周期长度</span>
              {chartStats.averageCycleLength !== null && (
                <span><i className="orange-dash" />平均周期 {chartStats.averageCycleLength}天</span>
              )}
            </div>

            <div className="cycle-bar-chart">
              {chartStats.averageCycleLength !== null && (
                <div
                  className="avg-line"
                  style={{ left: `${Math.min(86, (chartStats.averageCycleLength / getChartScale(chartStats)) * 100)}%` }}
                >
                  <span>平均 {chartStats.averageCycleLength}天</span>
                </div>
              )}
              {chartRows.length > 0 ? (
                chartRows.map((row) => (
                  <div className="cycle-row" key={row.key}>
                    <div className="cycle-row-label">
                      {row.current && <em>当前周期</em>}
                      <span>{row.label}</span>
                    </div>
                    <div className="cycle-row-body">
                      <div className="bar-track">
                        <i className="cycle-length" style={{ width: row.cycleWidth }} />
                        <i className="period-length" style={{ width: row.periodWidth }} />
                      </div>
                      <strong>{row.periodDays} 天 / {row.cycleLength ? `${row.cycleLength} 天` : '进行中'}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">这个范围内还没有可展示的完整记录。</div>
              )}
            </div>
          </section>

          <section className="analysis-section health-section">
            <div className="health-head">
              <h2>
                <Heart className="h-5 w-5 text-[#83ad75]" />
                周期健康评估
                <FigoDialog />
              </h2>
              {allStats.regularity?.score !== null && allStats.regularity ? (
                <strong>{allStats.regularity.score}<span>分</span></strong>
              ) : (
                <strong className="muted">暂无</strong>
              )}
            </div>
            <span>规律性评分</span>
            {allStats.regularity?.score !== null && allStats.regularity ? (
              <>
                <div className="health-progress">
                  <i style={{ width: `${allStats.regularity.score}%` }} />
                </div>
                <p>
                  CV={allStats.regularity.cv.toFixed(1)}% ｜ 标准差=
                  {allStats.regularity.stdDev.toFixed(1)}天 ｜ 样本=
                  {allStats.regularity.sampleSize}个周期
                </p>
              </>
            ) : (
              <div className="empty-state compact">至少需要 2 个有效周期，才能计算规律性评分。</div>
            )}
            <div className="health-messages">
              <span>{healthMessages.summary}</span>
              {healthMessages.items.map((item) => (
                <em className={item.tone} key={item.text}>{item.text}</em>
              ))}
            </div>
            <img className="health-leaf" src="/decor/leaf_cleaned.png" alt="" aria-hidden="true" />
          </section>

          <section className="analysis-section prediction-section">
            <h2>
              <Target className="h-5 w-5 text-[#f4a736]" />
              预测准确性分析
            </h2>

            {prediction ? (
              <PredictionMethodCard prediction={prediction} />
            ) : (
              <div className="empty-state compact">至少需要 2 个周期开始日期，才能生成预测方法说明。</div>
            )}

            {recentPredictions.length > 0 ? (
              <>
                <div className="prediction-metrics">
                  <PredictionMetric icon={Leaf} label="准确率" value={`${predictionAccuracy.accuracyRate}%`} desc="±2天内" />
                  <PredictionMetric icon={TrendingUp} label="平均误差" value={predictionAccuracy.avgError.toFixed(1)} unit="天" desc="绝对值" />
                  <PredictionMetric
                    icon={Heart}
                    label="置信度"
                    value={prediction ? `${Math.round(prediction.confidence * 100)}%` : '暂无'}
                    desc="统计估算"
                  />
                </div>

                <div className="prediction-list">
                  <span>最近预测记录（使用统计方法回测）</span>
                  {recentPredictions.map((item, index) => (
                    <div key={`${item.cycleDate}-${index}`}>
                      <span>{formatDateCN(parseLocalDate(item.cycleDate))} <small>({item.method.toUpperCase()})</small></span>
                      <em>预测{item.predicted}天 / 实际{item.actual}天</em>
                      <strong className={item.error >= 0 ? 'positive' : 'negative'}>
                        {item.error > 0 ? `+${item.error}天` : `${item.error}天`}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">真实回测数据不足。至少需要 3 个周期开始日期后，才能显示预测准确性列表。</div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}

function PredictionMethodCard({ prediction }: { prediction: PredictionResult }) {
  return (
    <div className="method-card">
      <Info className="h-5 w-5" />
      <div>
        <strong>当前使用：{getMethodName(prediction.method)}</strong>
        <span>
          预测周期：{prediction.predictedCycleLength} 天
          （置信区间：{prediction.lowerBound}-{prediction.upperBound}天）
        </span>
        <small>
          基于 {prediction.sampleSize} 个有效周期估算
          {prediction.outlierCount > 0 ? `，已降低 ${prediction.outlierCount} 个偏长周期的权重` : ''}
        </small>
      </div>
    </div>
  );
}

function FigoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="figo-info-button" aria-label="查看 FIGO 标准说明">
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="figo-dialog">
        <DialogHeader>
          <DialogTitle>FIGO 标准说明</DialogTitle>
          <DialogDescription>
            这里使用 FIGO AUB System 1 中对月经频率、规律性和经期时长的常用参考范围做健康教育提示。
          </DialogDescription>
        </DialogHeader>
        <div className="figo-dialog-body">
          <p>成人常见参考范围：周期频率约 24-38 天，经期时长不超过 8 天，周期规律性变化通常不超过 7-9 天。</p>
          <p>趋势页只根据你记录的数据做统计提醒，不能替代医生诊断；如果持续异常或伴随明显不适，建议咨询专业医生。</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatItem({
  icon: Icon,
  label,
  value,
  unit,
  desc,
  tone,
  score = null,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  unit: string;
  desc: string;
  tone: string;
  score?: number | null;
}) {
  return (
    <div className={`stat-item ${tone}`}>
      <div>
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </div>
      <strong>{value}<small>{unit}</small></strong>
      {score !== null ? <i style={{ width: `${score}%` }} /> : <em>{desc}</em>}
    </div>
  );
}

function PredictionMetric({
  icon: Icon,
  label,
  value,
  unit = '',
  desc,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  desc: string;
}) {
  return (
    <div>
      <span>
        <Icon className="h-9 w-9" />
      </span>
      <p>{label}</p>
      <strong>{value}{unit && <small>{unit}</small>}</strong>
      <small>{desc}</small>
    </div>
  );
}

function filterCycles(cycles: CycleData[], timeRange: TimeRange, year: number) {
  const sorted = getSortedCycles(cycles);
  if (timeRange === 'recent6') return sorted.slice(-6);
  if (timeRange === 'recent12') return sorted.slice(-12);
  if (timeRange === 'year') {
    return sorted.filter((cycle) => parseLocalDate(cycle.startDate).getFullYear() === year);
  }
  return sorted;
}

function getAvailableYears(cycles: CycleData[]) {
  return Array.from(new Set(cycles.map((cycle) => parseLocalDate(cycle.startDate).getFullYear()))).sort((a, b) => b - a);
}

function getSortedCycles(cycles: CycleData[]) {
  return [...cycles].sort(
    (a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime()
  );
}

function buildRangeStats(cycles: CycleData[]): RangeStats {
  const cycleLengths = extractCycleLengths(cycles).map((item) => item.length);
  const periodLengths = getPeriodLengths(cycles);
  const regularity = getRegularity(cycleLengths);

  return {
    averageCycleLength: average(cycleLengths),
    averagePeriodLength: average(periodLengths),
    totalCyclesTracked: cycles.length,
    cycleLengthRange: cycleLengths.length > 0 ? { min: Math.min(...cycleLengths), max: Math.max(...cycleLengths) } : null,
    periodLengthRange:
      periodLengths.length > 0
        ? {
            min: Math.min(...periodLengths),
            max: Math.max(...periodLengths),
            avg: average(periodLengths) ?? periodLengths[0],
          }
        : null,
    regularity,
  };
}

function getPeriodLengths(cycles: CycleData[]) {
  return cycles
    .filter((cycle) => cycle.startDate && cycle.endDate)
    .map((cycle) => {
      const start = parseLocalDate(cycle.startDate);
      const end = parseLocalDate(cycle.endDate!);
      return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
    })
    .filter((length) => length >= 1 && length <= 14);
}

function getRegularity(lengths: number[]): RangeStats['regularity'] {
  if (lengths.length === 0) return null;

  const mean = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  const min = Math.min(...lengths);
  const max = Math.max(...lengths);
  const variation = max - min;
  const stdDev = calculateStdDev(lengths);
  const cv = mean > 0 ? (stdDev / mean) * 100 : 0;
  const score = lengths.length >= 2 ? scoreRegularity(cv) : null;

  return {
    score,
    mean,
    min,
    max,
    variation,
    stdDev,
    cv,
    sampleSize: lengths.length,
    confidence: confidenceForSamples(lengths.length),
    lengths,
  };
}

function scoreRegularity(cv: number) {
  if (cv < 5) return Math.min(100, Math.round(90 + (5 - cv) * 2));
  if (cv < 10) return Math.round(75 + (10 - cv) * 3);
  if (cv < 15) return Math.round(60 + (15 - cv) * 3);
  if (cv < 20) return Math.round(40 + (20 - cv) * 4);
  return Math.max(0, Math.round(40 - (cv - 20) * 2));
}

function confidenceForSamples(sampleSize: number): MetricConfidence {
  if (sampleSize >= 4) return 'high';
  if (sampleSize >= 2) return 'medium';
  return 'low';
}

function buildChartRows(cycles: CycleData[], stats: RangeStats) {
  const chronological = getSortedCycles(cycles);
  const scale = getChartScale(stats);

  return [...chronological].reverse().map((cycle, index) => {
    const originalIndex = chronological.findIndex((item) => item.startDate === cycle.startDate);
    const next = chronological[originalIndex + 1];
    const start = parseLocalDate(cycle.startDate);
    const end = cycle.endDate ? parseLocalDate(cycle.endDate) : start;
    const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    const cycleLength = next
      ? Math.round((parseLocalDate(next.startDate).getTime() - start.getTime()) / DAY_MS)
      : null;
    const current = index === 0 && !next;

    return {
      key: cycle.id || cycle.startDate,
      label: `${formatDateCN(start)} - ${next ? formatDateCN(parseLocalDate(next.startDate)) : '进行中'}`,
      periodDays,
      cycleLength,
      current,
      periodWidth: `${Math.min(100, (periodDays / scale) * 100)}%`,
      cycleWidth: `${cycleLength ? Math.min(100, (cycleLength / scale) * 100) : 22}%`,
    };
  });
}

function getChartScale(stats: RangeStats) {
  return Math.max(
    45,
    stats.averageCycleLength ?? 0,
    stats.cycleLengthRange?.max ?? 0,
    stats.periodLengthRange?.max ?? 0
  );
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function formatStatValue(value: number | null) {
  return value === null ? '暂无' : value;
}

function formatCycleRange(range: RangeStats['cycleLengthRange']) {
  if (!range) return '记录不足';
  return range.min === range.max ? `${range.min} 天` : `范围 ${range.min}-${range.max} 天`;
}

function formatPeriodRange(range: RangeStats['periodLengthRange']) {
  if (!range) return '记录不足';
  return range.min === range.max ? `${range.min} 天` : `范围 ${range.min}-${range.max} 天`;
}

function getRangeLabel(timeRange: TimeRange, activeYear: number) {
  if (timeRange === 'recent6') return '最近 6 个周期';
  if (timeRange === 'recent12') return '最近 12 个周期';
  if (timeRange === 'year') return `${activeYear} 年`;
  return '全部周期';
}

function getHealthMessages(stats: RangeStats) {
  const summary = '参考 FIGO 标准：周期 24-38 天、经期 ≤8 天、周期变异 ≤7-9 天。';

  if (!stats.regularity || stats.averageCycleLength === null) {
    return {
      summary,
      items: [{ text: '△ 有效周期记录不足，继续记录后再评估规律性。', tone: 'neutral' }],
    };
  }

  const items: Array<{ text: string; tone: string }> = [];
  const avgCycle = stats.averageCycleLength;
  const avgPeriod = stats.averagePeriodLength;
  const variation = stats.regularity.variation;

  if (avgCycle < FIGO_MIN_CYCLE) {
    items.push({ text: `△ 平均周期偏短（${avgCycle}天），建议持续观察。`, tone: 'warning' });
  } else if (avgCycle > FIGO_MAX_CYCLE) {
    items.push({ text: `△ 平均周期偏长（${avgCycle}天），建议持续观察。`, tone: 'warning' });
  }

  if (avgPeriod !== null && avgPeriod > FIGO_MAX_PERIOD) {
    items.push({ text: `△ 平均经期偏长（${avgPeriod}天），如持续出现建议咨询医生。`, tone: 'warning' });
  }

  if (variation > FIGO_MAX_VARIATION) {
    items.push({ text: `△ 周期变异 ${variation} 天，超过常用参考范围，建议记录更多周期。`, tone: 'warning' });
  }

  if (items.length === 0) {
    items.push({
      text: `✓ 当前记录接近常用参考范围：周期 ${stats.regularity.min}-${stats.regularity.max} 天，变异 ${variation} 天。`,
      tone: 'ok',
    });
  }

  return { summary, items };
}
