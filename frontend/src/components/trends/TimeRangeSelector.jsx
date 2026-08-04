// ═══════════════════════════════════════════════════════════
// TimeRangeSelector Component — Blue theme rebrand
//
// Task Bundle applied:
//   ✅ T025  — Accepts `disabled` prop (locked during live mode)
//   ✅ BONUS — Blue theme, Lucide icons
//   ✅ BONUS — Custom range validation (end > start)
// ═══════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { Clock, Play, Sliders } from 'lucide-react';

const PRESET_RANGES = [
  { label: '15 Min',  value: '15m', aggregation: '5s' },
  { label: '30 Min',  value: '30m', aggregation: '10s' },
  { label: '1 Hour',  value: '1h',  aggregation: '10s' },
  { label: '6 Hours', value: '6h',  aggregation: '1m' },
  { label: '12 Hrs',  value: '12h', aggregation: '2m' },
  { label: '24 Hrs',  value: '24h', aggregation: '5m' },
  { label: '7 Days',  value: '7d',  aggregation: '1h' },
  { label: '30 Days', value: '30d', aggregation: '6h' },
];

// ─── Theme ───
const C = {
  card:       '#FFFFFF',
  cardSubtle: '#F8FAFC',
  cardHover:  '#EEF6FF',
  border:     '#E5E7EB',
  heading:    '#081B43',
  text:       '#334155',
  muted:      '#5F6B7A',
  subtle:     '#94A3B8',
  brand:      '#2563EB',
  brandDark:  '#0F3D91',
  btnPrimary: '#081B43',
  btnHover:   '#123E8A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
};

const TimeRangeSelector = ({
  selectedRange,
  onRangeChange,
  onCustomRange,
  isLoading = false,
  disabled = false,   // ✅ T025 - disabled during live mode
}) => {
  const [mode, setMode] = useState('preset');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [customError, setCustomError] = useState('');

  const handleCustomApply = () => {
    setCustomError('');
    if (!customStart || !customEnd) {
      setCustomError('Both start and end times are required');
      return;
    }
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setCustomError('Invalid date/time');
      return;
    }
    if (end <= start) {
      setCustomError('End time must be after start time');
      return;
    }
    onCustomRange({
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      aggregation: '1m',
    });
  };

  const isDisabled = disabled || isLoading;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Clock size={16} style={{ color: C.brand }} />
        <h3
          style={{
            color: C.heading,
            fontWeight: 700,
            fontSize: '14px',
            fontFamily: "'Montserrat', sans-serif",
            flex: 1,
          }}
        >
          Time Range
        </h3>
        {disabled && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: C.danger,
              padding: '2px 6px',
              background: '#FEE2E2',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Locked (Live)
          </span>
        )}
      </div>

      {/* ─── Mode Toggle ─── */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <button
          onClick={() => setMode('preset')}
          disabled={isDisabled}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            background: mode === 'preset' ? C.brand : C.cardSubtle,
            color: mode === 'preset' ? '#FFFFFF' : C.text,
            border: `1px solid ${mode === 'preset' ? C.brand : C.border}`,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Preset
        </button>
        <button
          onClick={() => setMode('custom')}
          disabled={isDisabled}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            background: mode === 'custom' ? C.brand : C.cardSubtle,
            color: mode === 'custom' ? '#FFFFFF' : C.text,
            border: `1px solid ${mode === 'custom' ? C.brand : C.border}`,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <Sliders size={11} style={{ display: 'inline', marginRight: '4px' }} />
          Custom
        </button>
      </div>

      {/* ─── Preset Ranges ─── */}
      {mode === 'preset' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          {PRESET_RANGES.map((range) => {
            const isActive = selectedRange === range.value;
            return (
              <button
                key={range.value}
                onClick={() => onRangeChange(range)}
                disabled={isDisabled}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  background: isActive ? C.brand : C.cardSubtle,
                  color: isActive ? '#FFFFFF' : C.text,
                  border: `1px solid ${isActive ? C.brand : C.border}`,
                  transition: 'all 0.15s ease',
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = C.cardHover;
                    e.currentTarget.style.borderColor = C.brand;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive && !isDisabled) {
                    e.currentTarget.style.background = C.cardSubtle;
                    e.currentTarget.style.borderColor = C.border;
                  }
                }}
                title={`Aggregation: ${range.aggregation}`}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Custom Range ─── */}
      {mode === 'custom' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 600,
                color: C.muted,
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Start Time
            </label>
            <input
              type="datetime-local"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setCustomError(''); }}
              disabled={isDisabled}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                background: C.cardSubtle,
                border: `1px solid ${C.border}`,
                borderRadius: '6px',
                outline: 'none',
                color: C.heading,
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={(e) => { e.target.style.borderColor = C.brand; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 600,
                color: C.muted,
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              End Time
            </label>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setCustomError(''); }}
              disabled={isDisabled}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                background: C.cardSubtle,
                border: `1px solid ${C.border}`,
                borderRadius: '6px',
                outline: 'none',
                color: C.heading,
                fontFamily: "'Inter', sans-serif",
              }}
              onFocus={(e) => { e.target.style.borderColor = C.brand; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
          </div>

          {customError && (
            <div
              style={{
                fontSize: '11px',
                color: C.danger,
                background: '#FEE2E2',
                border: `1px solid ${C.danger}40`,
                borderRadius: '6px',
                padding: '6px 8px',
                fontWeight: 500,
              }}
            >
              ⚠ {customError}
            </div>
          )}

          <button
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd || isDisabled}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              cursor: !customStart || !customEnd || isDisabled ? 'not-allowed' : 'pointer',
              background: !customStart || !customEnd || isDisabled ? '#CBD5E1' : C.btnPrimary,
              color: '#FFFFFF',
              border: 'none',
              transition: 'background 0.15s ease',
              fontFamily: "'Montserrat', sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: !customStart || !customEnd || isDisabled ? 'none' : '0px 2px 6px rgba(8, 27, 67, 0.25)',
            }}
            onMouseEnter={(e) => {
              if (customStart && customEnd && !isDisabled) e.currentTarget.style.background = C.btnHover;
            }}
            onMouseLeave={(e) => {
              if (customStart && customEnd && !isDisabled) e.currentTarget.style.background = C.btnPrimary;
            }}
          >
            <Play size={12} />
            {isLoading ? 'Loading...' : 'Apply Range'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TimeRangeSelector;