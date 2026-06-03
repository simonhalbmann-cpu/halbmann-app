'use client';

import { useMemo, useState } from 'react';

export type RentHistoryChartPoint = {
  coldRent: number;
  date: string;
  label: string;
  netOperatingCosts?: number;
  pointType?: 'current' | 'history' | 'planned';
};

type RentHistoryChartProps = {
  defaultMode?: 'both' | 'cold' | 'costs';
  emptyText?: string;
  framed?: boolean;
  points: RentHistoryChartPoint[];
  showCosts?: boolean;
  subtitle: string;
  title: string;
};

function formatMoneyNumber(value: number) {
  return `${new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} EUR`;
}

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE').format(date);
}

function formatMonthLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' }).format(date);
}

function sortPoints(left: RentHistoryChartPoint, right: RentHistoryChartPoint) {
  return (
    new Date(`${left.date}T12:00:00`).getTime() - new Date(`${right.date}T12:00:00`).getTime()
  );
}

export default function RentHistoryChart({
  defaultMode = 'both',
  emptyText = 'Keine Daten vorhanden.',
  framed = true,
  points,
  showCosts = true,
  subtitle,
  title,
}: RentHistoryChartProps) {
  const [mode, setMode] = useState<'both' | 'cold' | 'costs'>(defaultMode);

  const safeMode = showCosts ? mode : 'cold';
  const sortedPoints = useMemo(
    () => points.filter((point) => point.date).slice().sort(sortPoints),
    [points]
  );

  const chart = useMemo(() => {
    if (sortedPoints.length === 0) return null;

    const width = 760;
    const height = 260;
    const padding = { bottom: 36, left: 52, right: 20, top: 20 };
    const minDate = new Date(`${sortedPoints[0].date}T12:00:00`).getTime();
    const maxDate = new Date(`${sortedPoints[sortedPoints.length - 1].date}T12:00:00`).getTime();
    const dateRange = Math.max(maxDate - minDate, 1);
    const visibleValues = sortedPoints.flatMap((point) => {
      const values: number[] = [];
      if (safeMode === 'both' || safeMode === 'cold') values.push(point.coldRent);
      if (showCosts && (safeMode === 'both' || safeMode === 'costs')) {
        values.push(point.netOperatingCosts ?? 0);
      }
      return values;
    });
    const maxValue = Math.max(...visibleValues, 1);

    const toX = (dateValue: string) => {
      const timestamp = new Date(`${dateValue}T12:00:00`).getTime();
      return padding.left + ((timestamp - minDate) / dateRange) * (width - padding.left - padding.right);
    };

    const toY = (value: number) =>
      height - padding.bottom - (value / (maxValue * 1.15)) * (height - padding.top - padding.bottom);

    const coldLine = sortedPoints
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${toX(point.date).toFixed(2)} ${toY(point.coldRent).toFixed(2)}`
      )
      .join(' ');
    const costLine = sortedPoints
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${toX(point.date).toFixed(2)} ${toY(point.netOperatingCosts ?? 0).toFixed(2)}`
      )
      .join(' ');

    return {
      coldLine,
      costLine,
      height,
      points: sortedPoints.map((point) => ({
        ...point,
        costX: toX(point.date),
        costY: toY(point.netOperatingCosts ?? 0),
        x: toX(point.date),
        y: toY(point.coldRent),
      })),
      ticks: sortedPoints.map((point) => ({
        date: point.date,
        label: formatMonthLabel(point.date),
        x: toX(point.date),
      })),
      width,
    };
  }, [safeMode, showCosts, sortedPoints]);

  const Wrapper = framed ? 'section' : 'div';

  return (
    <Wrapper className={framed ? 'rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-38px_rgba(148,119,77,0.28)]' : ''}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-700/80">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{subtitle}</p>
        </div>
        {showCosts ? (
          <div className="inline-flex rounded-full border border-stone-300 bg-white p-1">
            {[
              { label: 'Beide', value: 'both' },
              { label: 'Kaltmiete', value: 'cold' },
              { label: 'Nebenkosten', value: 'costs' },
            ].map((option) => (
              <button
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  safeMode === option.value ? 'bg-amber-700 text-white' : 'text-slate-600 hover:text-slate-950'
                }`}
                key={option.value}
                onClick={() => setMode(option.value as 'both' | 'cold' | 'costs')}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {chart ? (
        <>
          <div className="mt-5 overflow-x-auto">
            <svg className="h-auto min-w-[720px] w-full" viewBox={`0 0 ${chart.width} ${chart.height}`}>
              {[0.25, 0.5, 0.75, 1].map((step) => {
                const y = chart.height - 36 - step * (chart.height - 56);
                return (
                  <line
                    key={step}
                    stroke="#e7e5e4"
                    strokeDasharray="4 6"
                    strokeWidth="1"
                    x1="52"
                    x2={chart.width - 20}
                    y1={y}
                    y2={y}
                  />
                );
              })}

              {safeMode !== 'costs' ? (
                <path d={chart.coldLine} fill="none" stroke="#b45309" strokeWidth="3" />
              ) : null}
              {showCosts && safeMode !== 'cold' ? (
                <path d={chart.costLine} fill="none" stroke="#0f766e" strokeWidth="3" />
              ) : null}

              {chart.points.map((point) => (
                <g key={`${point.date}-${point.label}`}>
                  {safeMode !== 'costs' ? (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill={point.pointType === 'planned' ? '#f59e0b' : '#b45309'}
                      r="4.5"
                    >
                      <title>{`${point.label}: ${formatDateLabel(point.date)} - ${formatMoneyNumber(point.coldRent)}`}</title>
                    </circle>
                  ) : null}
                  {showCosts && safeMode !== 'cold' ? (
                    <circle cx={point.costX} cy={point.costY} fill="#0f766e" r="4.5">
                      <title>{`Nebenkosten: ${formatDateLabel(point.date)} - ${formatMoneyNumber(point.netOperatingCosts ?? 0)}`}</title>
                    </circle>
                  ) : null}
                </g>
              ))}

              {chart.ticks.map((tick) => (
                <text
                  fill="#78716c"
                  fontSize="11"
                  key={tick.date}
                  textAnchor="middle"
                  x={tick.x}
                  y={chart.height - 12}
                >
                  {tick.label}
                </text>
              ))}
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-700" />
              Kaltmiete
            </span>
            {showCosts ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-700" />
                Nebenkosten
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Geplante Erhoehung
            </span>
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-slate-600">
          {emptyText}
        </div>
      )}
    </Wrapper>
  );
}
