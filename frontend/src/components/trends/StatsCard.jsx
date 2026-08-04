// ═══════════════════════════════════════════════════════════
// StatsCard Component — Blue theme + enhanced stats
//
// Task Bundle applied:
//   ✅ T026  — Shows mean/min/max PLUS stddev, count, range
//   ✅ BONUS — Blue theme, Lucide icons
//   ✅ BONUS — Handles `hasData: false` gracefully (empty state)
//   ✅ BONUS — Smart number formatting (integers vs decimals)
// ═══════════════════════════════════════════════════════════

import React from 'react';
import {
  ArrowUp, ArrowDown, Minus, Sigma, Hash,
  BarChart3, Info,
} from 'lucide-react';

// ─── Theme ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
};

// ─── Smart number formatter ───
const formatValue = (v) => {
  if (typeof v !== 'number' || isNaN(v)) return '—';
  if (v === 0) return '0';
  if (Math.abs(v) >= 10000) return v.toFixed(0);
  if (Number.isInteger(v)) return v.toString();
  if (Math.abs(v) < 0.01) return v.toExponential(2);
  return v.toFixed(3);
};

const formatCount = (v) => {
  if (typeof v !== 'number' || isNaN(v)) return '0';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toString();
};

// ─── Single stat cell ───
const StatCell = ({ icon: Icon, label, value, unit, color, mono = true }) => (
  <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        background: `${color}12`,
        marginBottom: '6px',
      }}
    >
      <Icon size={14} style={{ color }} strokeWidth={2.5} />
    </div>
    <div
      style={{
        fontSize: '15px',
        fontWeight: 800,
        color,
        fontFamily: mono ? 'monospace' : "'Inter', sans-serif",
        lineHeight: '1.2',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={`${value}${unit ? ' ' + unit : ''}`}
    >
      {value}
      {unit && (
        <span style={{ fontSize: '9px', color: C.subtle, marginLeft: '2px', fontWeight: 500 }}>
          {unit}
        </span>
      )}
    </div>
    <div
      style={{
        fontSize: '10px',
        color: C.muted,
        marginTop: '2px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════
// Main StatsCard
// ═══════════════════════════════════════════════════════════
const StatsCard = ({ stats, tagName, unit = '', color = '#2563EB' }) => {
  // Empty state — no stats at all
  if (!stats) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: C.heading,
              fontFamily: "'Montserrat', sans-serif",
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tagName}
          </h4>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '16px 0',
            color: C.subtle,
            fontSize: '12px',
            fontStyle: 'italic',
          }}
        >
          <Info size={14} />
          Loading statistics...
        </div>
      </div>
    );
  }

  // "No data" state (InfluxDB returned but hasData: false)
  if (stats.hasData === false) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
          <h4
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: C.heading,
              fontFamily: "'Montserrat', sans-serif",
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tagName}
          </h4>
          {unit && (
            <span style={{ fontSize: '10px', color: C.subtle, fontFamily: 'monospace' }}>
              {unit}
            </span>
          )}
        </div>
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            background: C.cardSubtle,
            borderRadius: '8px',
            border: `1px dashed ${C.border}`,
          }}
        >
          <Info size={20} style={{ color: C.subtle, margin: '0 auto 6px', display: 'block' }} />
          <p style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>
            No historical data available
          </p>
          <p style={{ fontSize: '10px', color: C.subtle, marginTop: '4px' }}>
            Requires InfluxDB connection
          </p>
        </div>
      </div>
    );
  }

  // Normal render with data
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${color}80`;
        e.currentTarget.style.boxShadow = `0px 8px 24px rgba(8, 27, 67, 0.08)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.boxShadow = '0px 4px 20px rgba(8, 27, 67, 0.04)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
        <h4
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: C.heading,
            fontFamily: "'Montserrat', sans-serif",
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={tagName}
        >
          {tagName}
        </h4>
        {unit && (
          <span
            style={{
              fontSize: '10px',
              color: C.subtle,
              fontFamily: 'monospace',
              padding: '2px 6px',
              background: C.cardSubtle,
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {/* Primary stats row: Min / Avg / Max */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '12px 0',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <StatCell icon={ArrowDown} label="Min" value={formatValue(stats.min)} color={color} />
        <StatCell icon={Minus}     label="Avg" value={formatValue(stats.mean)} color={color} />
        <StatCell icon={ArrowUp}   label="Max" value={formatValue(stats.max)} color={color} />
      </div>

      {/* Secondary stats row: StdDev / Count / Range (T026) */}
      <div style={{ display: 'flex', gap: '4px', paddingTop: '12px' }}>
        <StatCell
          icon={Sigma}
          label="Std Dev"
          value={formatValue(stats.stddev ?? 0)}
          color={C.muted}
        />
        <StatCell
          icon={Hash}
          label="Samples"
          value={formatCount(stats.count ?? 0)}
          color={C.muted}
        />
        <StatCell
          icon={BarChart3}
          label="Range"
          value={formatValue(stats.range ?? (stats.max - stats.min))}
          color={C.muted}
        />
      </div>
    </div>
  );
};

export default StatsCard;