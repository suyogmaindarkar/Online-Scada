// ═══════════════════════════════════════════════════════════
// TrendChart Component - Blue Theme + Zoom/Pan + Live Mode
//
// Task Bundle applied:
//   ✅ T022  — Multi-tag overlay (accepts colors prop from parent)
//   ✅ T024  — Zoom & pan via enhanced Brush + tooltip crosshair
//   ✅ T025  — Live mode: sliding window (last N points, no brush)
//   ✅ BONUS — Blue theme (matches landing site palette)
//   ✅ BONUS — Better tooltip, custom legend, dynamic Y-axis padding
// ═══════════════════════════════════════════════════════════

import React, { useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

// ─── Fallback blue-theme chart colors (used only if parent doesn't pass colors) ───
const DEFAULT_COLORS = [
  '#2563EB',  // brand-accent
  '#16A34A',  // success
  '#DC2626',  // danger
  '#F59E0B',  // warning
  '#9333EA',  // purple
  '#0891B2',  // cyan
  '#EA580C',  // orange
  '#0F3D91',  // brand-primary
];

// ─── Theme constants ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  border:     '#E5E7EB',
  gridLine:   '#F1F5F9',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
};

// ═══════════════════════════════════════════════════════════
// Custom Tooltip (blue theme, matches landing site cards)
// ═══════════════════════════════════════════════════════════
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        padding: '10px 12px',
        boxShadow: '0px 8px 24px rgba(8, 27, 67, 0.12)',
        fontFamily: "'Inter', sans-serif",
        minWidth: '200px',
      }}
    >
      <p
        style={{
          color: C.muted,
          fontSize: '11px',
          marginBottom: '8px',
          borderBottom: `1px solid ${C.border}`,
          paddingBottom: '4px',
        }}
      >
        {format(new Date(label), 'dd/MM/yyyy HH:mm:ss')}
      </p>
      {payload.map((entry, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            padding: '3px 0',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: C.text, flex: 1, fontWeight: 500 }}>
            {entry.name}:
          </span>
          <span
            style={{
              color: entry.color,
              fontWeight: 700,
              fontFamily: 'monospace',
            }}
          >
            {typeof entry.value === 'number'
              ? entry.value.toFixed(3)
              : entry.value ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Custom Legend (blue theme)
// ═══════════════════════════════════════════════════════════
const CustomLegend = ({ payload }) => {
  if (!payload || !payload.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        justifyContent: 'center',
        padding: '8px 0',
        fontSize: '12px',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {payload.map((entry, index) => (
        <div
          key={index}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <div
            style={{
              width: '14px',
              height: '3px',
              background: entry.color,
              borderRadius: '2px',
            }}
          />
          <span style={{ color: C.text, fontWeight: 500 }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// Main TrendChart Component
// ═══════════════════════════════════════════════════════════
const TrendChart = ({
  tags = [],
  height = 400,
  showBrush = true,
  showGrid = true,
  darkMode = false,        // Kept for backward compat, ignored (always light)
  liveMode = false,        // ✅ T025
  colors,                  // ✅ T022 — allow parent to pass colors
  livePointsWindow = 60,   // ✅ T025 — how many points to keep in live sliding window
}) => {
  const chartColors = colors && colors.length > 0 ? colors : DEFAULT_COLORS;

  // ─── Merge all tag data into time-indexed rows ───
  const mergeTagData = useCallback(() => {
    if (!tags.length) return [];

    const timeMap = {};

    tags.forEach((tag) => {
      if (!tag.data) return;
      tag.data.forEach((point) => {
        const timeKey = point.time;
        if (!timeMap[timeKey]) {
          timeMap[timeKey] = { time: timeKey };
        }
        timeMap[timeKey][tag.tagName || tag.tagId] = point.value;
      });
    });

    const sorted = Object.values(timeMap).sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );

    // ✅ T025: In live mode, show only the last N points for a "sliding window" effect
    if (liveMode && sorted.length > livePointsWindow) {
      return sorted.slice(-livePointsWindow);
    }

    return sorted;
  }, [tags, liveMode, livePointsWindow]);

  const chartData = useMemo(() => mergeTagData(), [mergeTagData]);

  // ─── Format X-axis timestamps ───
  const formatXAxis = (tickItem) => {
    try {
      const d = new Date(tickItem);
      // In live mode show HH:mm:ss, otherwise smart format based on range
      if (liveMode) return format(d, 'HH:mm:ss');
      return format(d, 'HH:mm:ss');
    } catch {
      return tickItem;
    }
  };

  // ─── Compute Y-axis domain with 5% padding ───
  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    let min = Infinity;
    let max = -Infinity;
    chartData.forEach((row) => {
      tags.forEach((tag) => {
        const key = tag.tagName || tag.tagId;
        const v = row[key];
        if (typeof v === 'number' && !isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      });
    });
    if (min === Infinity || max === -Infinity) return ['auto', 'auto'];
    if (min === max) {
      const pad = Math.abs(min * 0.1) || 1;
      return [min - pad, max + pad];
    }
    const range = max - min;
    const pad = range * 0.05;
    return [min - pad, max + pad];
  }, [chartData, tags]);

  // ─── Empty state ───
  if (!tags.length || !chartData.length) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: C.cardSubtle,
          border: `1px dashed ${C.border}`,
          borderRadius: '12px',
          height: `${height}px`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <TrendingUp
            size={40}
            style={{ color: C.subtle, margin: '0 auto 12px', display: 'block' }}
          />
          <p style={{ color: C.muted, fontWeight: 500, fontSize: '14px' }}>
            No trend data available
          </p>
          <p style={{ color: C.subtle, fontSize: '12px', marginTop: '4px' }}>
            {liveMode
              ? 'Waiting for live data...'
              : 'Select tags and time range to view trends'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: '12px',
        padding: '8px 4px 4px',
        background: C.card,
        height: `${height + 60}px`,
      }}
    >
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
        >
          {/* Grid */}
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={C.gridLine}
              vertical={true}
            />
          )}

          {/* X Axis - Time */}
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxis}
            stroke={C.subtle}
            tick={{ fill: C.text, fontSize: 11, fontFamily: 'monospace' }}
            tickLine={{ stroke: C.border }}
            axisLine={{ stroke: C.border }}
            minTickGap={30}
          />

          {/* Y Axis - Values */}
          <YAxis
            stroke={C.subtle}
            tick={{ fill: C.text, fontSize: 11, fontFamily: 'monospace' }}
            tickLine={{ stroke: C.border }}
            axisLine={{ stroke: C.border }}
            tickFormatter={(value) => {
              if (typeof value !== 'number') return value;
              // Smart formatting: integers show as int, otherwise 2 decimals
              if (Number.isInteger(value)) return value.toString();
              if (Math.abs(value) >= 1000) return value.toFixed(0);
              return value.toFixed(2);
            }}
            domain={yDomain}
          />

          {/* Tooltip with crosshair cursor */}
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: C.brand, strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          {/* Custom Legend */}
          <Legend content={<CustomLegend />} verticalAlign="top" />

          {/* ✅ T024: Brush for zoom/pan — hidden in live mode */}
          {showBrush && !liveMode && chartData.length > 20 && (
            <Brush
              dataKey="time"
              height={26}
              stroke={C.brand}
              fill={C.cardSubtle}
              tickFormatter={formatXAxis}
              travellerWidth={8}
              gap={5}
            />
          )}

          {/* Lines for each tag — T022 multi-tag overlay */}
          {tags.map((tag, index) => (
            <Line
              key={tag.tagId}
              type="monotone"
              dataKey={tag.tagName || tag.tagId}
              stroke={chartColors[index % chartColors.length]}
              strokeWidth={2}
              dot={liveMode ? false : { r: 2, strokeWidth: 0, fill: chartColors[index % chartColors.length] }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: C.card }}
              connectNulls={false}
              isAnimationActive={!liveMode}
              animationDuration={300}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;