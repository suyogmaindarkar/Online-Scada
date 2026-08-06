// ═══════════════════════════════════════════════════════════
// Process Picture Widgets — FIXED:
//   ✅ ResponsiveContainer replaced with custom useSize hook
//      (guarantees valid px dimensions, no more -1 errors)
//   ✅ Trend widget pushes initial sample immediately on mount
//   ✅ Trend widget uses liveValuesRef (interval doesn't restart on tag change)
//   ✅ Debug badge shows tag count + last values (helps troubleshoot)
//   ✅ Robust value handling — carries forward last known value
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, BarChart, Bar,
} from 'recharts';
import { BellRing, History, LineChart as LineIcon, Table2, BarChart3, Globe } from 'lucide-react';
import { alarmAPI } from '../../services/api';

// ═══════════════════════════════════════════════════════════
// CUSTOM HOOK: measure element size via ResizeObserver
// This REPLACES Recharts' ResponsiveContainer to guarantee
// valid pixel dimensions (never -1).
// ═══════════════════════════════════════════════════════════
const useSize = () => {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial measurement
    const rect = el.getBoundingClientRect();
    setSize({
      width:  Math.max(0, Math.floor(rect.width)),
      height: Math.max(0, Math.floor(rect.height)),
    });

    // Observe resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({
          width:  Math.max(0, Math.floor(width)),
          height: Math.max(0, Math.floor(height)),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
};

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════
const parseTagList = (tags) => {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
};

const toNumber = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
};

// ═══════════════════════════════════════════════════════════
// SEVERITY COLORS
// ═══════════════════════════════════════════════════════════
const SEVERITY_COLORS = {
  critical: { bg: '#FEE2E2', text: '#991B1B', border: '#DC2626' },
  high:     { bg: '#FED7AA', text: '#9A3412', border: '#EA580C' },
  medium:   { bg: '#FEF3C7', text: '#78350F', border: '#F59E0B' },
  low:      { bg: '#DBEAFE', text: '#1E3A8A', border: '#2563EB' },
  info:     { bg: '#F1F5F9', text: '#334155', border: '#94A3B8' },
};

const getSeverityStyle = (priority, scheme, rowIndex) => {
  if (scheme === 'plain') return { bg: '#FFF', text: '#334155', border: '#E5E7EB' };
  if (scheme === 'alternate') {
    return rowIndex % 2 === 0
      ? { bg: '#FFF', text: '#334155', border: '#E5E7EB' }
      : { bg: '#F8FAFC', text: '#334155', border: '#E5E7EB' };
  }
  const key = String(priority || '').toLowerCase();
  return SEVERITY_COLORS[key] || SEVERITY_COLORS.info;
};

// ═══════════════════════════════════════════════════════════
// ✅ TREND CHART WIDGET (fixed)
// ═══════════════════════════════════════════════════════════
export const TrendChartWidget = ({ element, liveValues, isDesignMode }) => {
  const [chartData, setChartData] = useState([]);
  const [chartRef, chartSize] = useSize();
  const tagList = parseTagList(element.trendTags);
  const colors = element.trendLineColors || ['#2563EB', '#DC2626', '#16A34A', '#F59E0B', '#9333EA'];
  const maxPoints = 60;

  // Keep latest liveValues in a ref so the interval doesn't restart
  const liveValuesRef = useRef(liveValues);
  useEffect(() => { liveValuesRef.current = liveValues; }, [liveValues]);

  // Track last known value per tag (carries forward if tag temporarily missing)
  const lastKnownRef = useRef({});

  // ── Design mode: mock data ──────────────────────────────
  useEffect(() => {
    if (!isDesignMode) return;
    const mockData = [];
    for (let i = 0; i < 20; i++) {
      const point = { time: `T-${20 - i}s` };
      tagList.forEach((tag, idx) => {
        point[tag] = 50 + Math.sin(i * 0.3 + idx) * 30;
      });
      mockData.push(point);
    }
    setChartData(mockData);
  }, [isDesignMode, tagList.join(',')]);

  // ── Runtime: sample tags on interval ────────────────────
  useEffect(() => {
    if (isDesignMode) return;
    if (tagList.length === 0) {
      setChartData([]);
      return;
    }

    // ✅ Reset data & last-known cache when tag list changes
    setChartData([]);
    lastKnownRef.current = {};

    const sample = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      const point = { time: timeStr, _ts: now.getTime() };

      tagList.forEach(tag => {
        const rawVal = liveValuesRef.current[tag];
        const numVal = toNumber(rawVal);

        if (numVal !== null) {
          lastKnownRef.current[tag] = numVal;
          point[tag] = numVal;
        } else if (lastKnownRef.current[tag] !== undefined) {
          // Carry forward last known value
          point[tag] = lastKnownRef.current[tag];
        } else {
          // No value yet — use 0 so line still draws
          point[tag] = 0;
        }
      });

      setChartData(prev => [...prev, point].slice(-maxPoints));
    };

    // ✅ Immediate first sample
    sample();

    const interval = setInterval(sample, element.trendUpdateInterval || 2000);
    return () => clearInterval(interval);
  }, [tagList.join(','), element.trendUpdateInterval, isDesignMode]);

  // ── Compute Y-axis domain ───────────────────────────────
  const yMin = element.trendYMin !== '' && element.trendYMin != null
    ? Number(element.trendYMin) : 'auto';
  const yMax = element.trendYMax !== '' && element.trendYMax != null
    ? Number(element.trendYMax) : 'auto';

  // ── Debug info for runtime troubleshooting ──────────────
  const debugText = !isDesignMode && tagList.length > 0
    ? tagList.map(t => {
        const v = liveValues[t];
        const shown = v === undefined ? '?' : v === null ? 'null' : typeof v === 'number' ? v.toFixed(1) : String(v).slice(0, 8);
        return `${t}=${shown}`;
      }).join(' · ')
    : null;

  // ── Chart drawable dimensions ───────────────────────────
  // We subtract padding + margins to get true chart area
  const chartW = Math.max(50, chartSize.width);
  const chartH = Math.max(50, chartSize.height);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: element.trendBackgroundColor || '#FFFFFF',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Title bar */}
      <div style={{
        padding: '4px 8px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: '6px',
        background: '#F8FAFC', flexShrink: 0, minHeight: '22px',
      }}>
        <LineIcon size={11} style={{ color: '#2563EB', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: element.trendTextColor || '#334155' }}>
          {element.trendTitle || 'Trend Chart'}
        </span>
        {isDesignMode && (
          <span style={{ fontSize: '9px', color: '#94A3B8', fontStyle: 'italic' }}>
            (Preview)
          </span>
        )}
        {!isDesignMode && chartData.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#10B981', fontFamily: 'monospace' }}>
            ● {chartData.length} pts
          </span>
        )}
      </div>

      {/* Debug bar (runtime only) — shows current tag values */}
      {debugText && (
        <div style={{
          padding: '2px 8px', background: '#F1F5F9',
          fontSize: '9px', fontFamily: 'monospace', color: '#5F6B7A',
          borderBottom: '1px solid #E5E7EB',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {debugText}
        </div>
      )}

      {/* Chart container — measured by useSize */}
      <div ref={chartRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {tagList.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#94A3B8', fontSize: '11px', fontStyle: 'italic',
            padding: '10px', textAlign: 'center',
          }}>
            Set "Tags" property (comma-separated tag names)
          </div>
        ) : chartData.length === 0 && !isDesignMode ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#94A3B8', fontSize: '11px', fontStyle: 'italic',
          }}>
            Collecting data…
          </div>
        ) : chartSize.width > 0 && chartSize.height > 0 ? (
          // ✅ Use LineChart with EXPLICIT px dimensions (no ResponsiveContainer)
          <LineChart
            width={chartW}
            height={chartH}
            data={chartData}
            margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
          >
            {element.trendShowGrid !== false && (
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            )}
            {element.trendShowAxis !== false && (
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: element.trendTextColor || '#334155' }}
                interval="preserveStartEnd"
                minTickGap={30}
              />
            )}
            {element.trendShowAxis !== false && (
              <YAxis
                tick={{ fontSize: 9, fill: element.trendTextColor || '#334155' }}
                domain={[yMin, yMax]}
                width={40}
              />
            )}
            <Tooltip
              contentStyle={{ fontSize: 10, padding: '4px 8px' }}
              labelStyle={{ fontWeight: 700 }}
            />
            {element.trendShowLegend !== false && (
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: '2px' }} />
            )}
            {tagList.map((tag, idx) => (
              <Line
                key={tag}
                type="monotone"
                dataKey={tag}
                stroke={colors[idx % colors.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={true}
              />
            ))}
          </LineChart>
        ) : null /* still measuring */}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ALARM LIST WIDGET
// ═══════════════════════════════════════════════════════════
export const AlarmListWidget = ({ element, isDesignMode }) => {
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    if (isDesignMode) {
      setAlarms([
        { _id: '1', triggeredAt: new Date(), priority: 'critical', tagName: 'TANK_LEVEL', message: 'Tank level exceeded 95%' },
        { _id: '2', triggeredAt: new Date(), priority: 'high',     tagName: 'MOTOR_TEMP', message: 'Motor temperature high' },
        { _id: '3', triggeredAt: new Date(), priority: 'medium',   tagName: 'PRESSURE',   message: 'Pressure fluctuation detected' },
        { _id: '4', triggeredAt: new Date(), priority: 'low',      tagName: 'FLOW_RATE',  message: 'Flow rate below setpoint' },
      ]);
      return;
    }

    let alive = true;
    const load = async () => {
      try {
        const res = await alarmAPI.getActive();
        if (!alive) return;
        let list = res.data?.data || [];
        if (element.alarmFilterPriority && element.alarmFilterPriority !== 'all') {
          list = list.filter(a => String(a.priority).toLowerCase() === element.alarmFilterPriority);
        }
        setAlarms(list.slice(0, element.alarmMaxRows || 50));
      } catch (err) {
        console.warn('[AlarmListWidget] load failed:', err.message);
      }
    };
    load();
    const interval = setInterval(load, element.alarmRefreshInterval || 2000);
    return () => { alive = false; clearInterval(interval); };
  }, [element.alarmMaxRows, element.alarmFilterPriority, element.alarmRefreshInterval, isDesignMode]);

  const columns = element.alarmShowColumns || ['time', 'priority', 'source', 'message'];

  return (
    <div style={{
      width: '100%', height: '100%',
      background: element.alarmBackgroundColor || '#FFFFFF',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: '6px',
        background: element.alarmHeaderColor || '#081B43', flexShrink: 0,
      }}>
        <BellRing size={12} style={{ color: '#FFF' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF' }}>
          {element.alarmTitle || 'Active Alarms'} ({alarms.length})
        </span>
        {isDesignMode && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#CBD5E1', fontStyle: 'italic' }}>
            (Preview)
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#F1F5F9', zIndex: 1 }}>
            <tr>
              {columns.includes('time')     && <th style={thStyle}>Time</th>}
              {columns.includes('priority') && <th style={thStyle}>Priority</th>}
              {columns.includes('source')   && <th style={thStyle}>Source</th>}
              {columns.includes('message')  && <th style={thStyle}>Message</th>}
            </tr>
          </thead>
          <tbody>
            {alarms.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>
                No active alarms
              </td></tr>
            ) : (
              alarms.map((a, i) => {
                const style = getSeverityStyle(a.priority, element.alarmColorScheme, i);
                return (
                  <tr key={a._id || i} style={{
                    background: style.bg, color: style.text,
                    borderLeft: `3px solid ${style.border}`,
                  }}>
                    {columns.includes('time')     && <td style={tdStyle}>{new Date(a.triggeredAt || a.createdAt || Date.now()).toLocaleTimeString()}</td>}
                    {columns.includes('priority') && <td style={{ ...tdStyle, fontWeight: 700, textTransform: 'uppercase' }}>{a.priority || 'info'}</td>}
                    {columns.includes('source')   && <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{a.tagName || a.source || '—'}</td>}
                    {columns.includes('message')  && <td style={tdStyle}>{a.message || a.description || '—'}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ALARM HISTORY WIDGET
// ═══════════════════════════════════════════════════════════
export const AlarmHistoryWidget = ({ element, isDesignMode }) => {
  const [alarms, setAlarms] = useState([]);

  useEffect(() => {
    if (isDesignMode) {
      setAlarms(Array.from({ length: 8 }, (_, i) => ({
        _id: `hist-${i}`,
        triggeredAt: new Date(Date.now() - i * 3600000),
        acknowledgedAt: i > 3 ? null : new Date(Date.now() - i * 3600000 + 60000),
        priority: ['critical', 'high', 'medium', 'low'][i % 4],
        tagName: `TAG_${i}`,
        message: `Historical alarm event #${i}`,
      })));
      return;
    }

    let alive = true;
    const load = async () => {
      try {
        const filters = { timeRange: element.alarmHistTimeRange || '24h' };
        if (element.alarmHistFilterPriority && element.alarmHistFilterPriority !== 'all') {
          filters.priority = element.alarmHistFilterPriority;
        }
        const res = await alarmAPI.getHistory(filters);
        if (!alive) return;
        let list = res.data?.data || [];
        setAlarms(list.slice(0, element.alarmHistMaxRows || 100));
      } catch (err) {
        console.warn('[AlarmHistoryWidget] load failed:', err.message);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => { alive = false; clearInterval(interval); };
  }, [element.alarmHistMaxRows, element.alarmHistTimeRange, element.alarmHistFilterPriority, isDesignMode]);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: element.alarmHistBackgroundColor || '#FFFFFF',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: '6px',
        background: element.alarmHistHeaderColor || '#081B43', flexShrink: 0,
      }}>
        <History size={12} style={{ color: '#FFF' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF' }}>
          {element.alarmHistTitle || 'Alarm History'} · {element.alarmHistTimeRange || '24h'}
        </span>
        {isDesignMode && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#CBD5E1', fontStyle: 'italic' }}>
            (Preview)
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#F1F5F9', zIndex: 1 }}>
            <tr>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Priority</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Message</th>
              <th style={thStyle}>Ack</th>
            </tr>
          </thead>
          <tbody>
            {alarms.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' }}>
                No history in range
              </td></tr>
            ) : (
              alarms.map((a, i) => {
                const style = getSeverityStyle(a.priority, 'severity', i);
                return (
                  <tr key={a._id || i} style={{ background: style.bg, color: style.text, borderLeft: `3px solid ${style.border}` }}>
                    <td style={tdStyle}>{new Date(a.triggeredAt || a.createdAt).toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, textTransform: 'uppercase' }}>{a.priority || 'info'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{a.tagName || a.source || '—'}</td>
                    <td style={tdStyle}>{a.message || a.description || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{a.acknowledgedAt ? '✓' : '⋯'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// DATA TABLE WIDGET
// ═══════════════════════════════════════════════════════════
export const DataTableWidget = ({ element, liveValues, tags, isDesignMode }) => {
  const tagList = parseTagList(element.tableTags);
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick(t => t + 1), element.tableRefreshInterval || 1000);
    return () => clearInterval(interval);
  }, [element.tableRefreshInterval]);

  const findTagMeta = (tagName) => tags?.find(t => t.tagName === tagName) || null;

  return (
    <div style={{
      width: '100%', height: '100%',
      background: element.tableBackgroundColor || '#FFFFFF',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: `1px solid ${element.tableBorderColor || '#E5E7EB'}`,
    }}>
      <div style={{
        padding: '6px 10px', borderBottom: `1px solid ${element.tableBorderColor || '#E5E7EB'}`,
        display: 'flex', alignItems: 'center', gap: '6px',
        background: element.tableHeaderColor || '#081B43', flexShrink: 0,
      }}>
        <Table2 size={12} style={{ color: '#FFF' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFF' }}>
          {element.tableTitle || 'Data Table'}
        </span>
        {isDesignMode && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#CBD5E1', fontStyle: 'italic' }}>
            (Preview)
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {tagList.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '11px', fontStyle: 'italic' }}>
            Configure "Tags" property
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: element.tableTextColor || '#334155' }}>
            {element.tableShowHeader !== false && (
              <thead style={{ background: '#F1F5F9', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={thStyle}>Tag</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Unit</th>
                </tr>
              </thead>
            )}
            <tbody>
              {tagList.map((tag, i) => {
                const meta = findTagMeta(tag);
                const val = isDesignMode ? (Math.random() * 100).toFixed(1) : liveValues[tag];
                const displayVal = val === undefined || val === null ? '—' : typeof val === 'number' ? val.toFixed(2) : String(val);
                const bg = element.tableAlternateRows !== false && i % 2 === 1 ? '#F8FAFC' : 'transparent';
                return (
                  <tr key={tag} style={{ background: bg }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{tag}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', textAlign: 'right' }}>{displayVal}</td>
                    <td style={{ ...tdStyle, color: '#94A3B8' }}>{meta?.unit || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// BAR CHART WIDGET (fixed with useSize)
// ═══════════════════════════════════════════════════════════
export const BarChartWidget = ({ element, liveValues, isDesignMode }) => {
  const tagList = parseTagList(element.barChartTags);
  const [chartRef, chartSize] = useSize();
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => tick(t => t + 1), element.barChartRefreshInterval || 1000);
    return () => clearInterval(interval);
  }, [element.barChartRefreshInterval]);

  const data = tagList.map(tag => {
    const val = isDesignMode ? Math.random() * 100 : liveValues[tag];
    return { name: tag, value: toNumber(val) ?? 0 };
  });

  const chartW = Math.max(50, chartSize.width);
  const chartH = Math.max(50, chartSize.height);

  return (
    <div style={{
      width: '100%', height: '100%',
      background: element.barChartBackgroundColor || '#FFFFFF',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '4px 8px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: '6px',
        background: '#F8FAFC', flexShrink: 0, minHeight: '22px',
      }}>
        <BarChart3 size={11} style={{ color: '#16A34A' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: element.barChartTextColor || '#334155' }}>
          {element.barChartTitle || 'Bar Chart'}
        </span>
        {isDesignMode && (
          <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#94A3B8', fontStyle: 'italic' }}>
            (Preview)
          </span>
        )}
      </div>

      <div ref={chartRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {tagList.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '11px', fontStyle: 'italic' }}>
            Configure "Tags" property
          </div>
        ) : chartSize.width > 0 && chartSize.height > 0 ? (
          <BarChart
            width={chartW}
            height={chartH}
            data={data}
            layout={element.barChartOrientation === 'horizontal' ? 'vertical' : 'horizontal'}
            margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            {element.barChartOrientation === 'horizontal' ? (
              <>
                <XAxis type="number" tick={{ fontSize: 9 }} domain={[Number(element.barChartYMin) || 0, Number(element.barChartYMax) || 100]} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={60} />
              </>
            ) : (
              <>
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} width={40} domain={[Number(element.barChartYMin) || 0, Number(element.barChartYMax) || 100]} />
              </>
            )}
            <Tooltip contentStyle={{ fontSize: 10, padding: '4px 8px' }} />
            {element.barChartShowLegend && <Legend wrapperStyle={{ fontSize: 10 }} />}
            <Bar
              dataKey="value"
              fill={(element.barChartColors && element.barChartColors[0]) || '#2563EB'}
              isAnimationActive={false}
              label={element.barChartShowValues !== false ? { fontSize: 10, position: 'top' } : false}
            />
          </BarChart>
        ) : null}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// WEB FRAME WIDGET
// ═══════════════════════════════════════════════════════════
export const WebFrameWidget = ({ element, isDesignMode }) => {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      border: element.webShowBorder !== false ? `1px solid ${element.webBorderColor || '#E5E7EB'}` : 'none',
    }}>
      <div style={{
        padding: '6px 10px', borderBottom: '1px solid #E5E7EB',
        display: 'flex', alignItems: 'center', gap: '6px',
        background: '#F8FAFC', flexShrink: 0,
      }}>
        <Globe size={12} style={{ color: '#EA580C' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {element.webTitle || 'Web Frame'}
        </span>
        {isDesignMode && (
          <span style={{ fontSize: '9px', color: '#94A3B8', fontStyle: 'italic', flexShrink: 0 }}>
            (Preview)
          </span>
        )}
      </div>
      {isDesignMode ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#F8FAFC', color: '#5F6B7A', gap: '8px',
        }}>
          <Globe size={32} style={{ color: '#94A3B8' }} />
          <p style={{ fontSize: '11px', margin: 0 }}>Web content shown in runtime</p>
          <p style={{ fontSize: '10px', margin: 0, fontFamily: 'monospace', color: '#94A3B8', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {element.webUrl || 'https://...'}
          </p>
        </div>
      ) : (
        <iframe
          src={element.webUrl}
          style={{ flex: 1, border: 'none', width: '100%', height: '100%' }}
          title={element.webTitle || 'Web Frame'}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN DISPATCHER
// ═══════════════════════════════════════════════════════════
export const ProcessPictureWidget = ({ element, liveValues, tags, isDesignMode }) => {
  switch (element.type) {
    case 'trendControl':        return <TrendChartWidget    element={element} liveValues={liveValues} isDesignMode={isDesignMode} />;
    case 'alarmControl':        return <AlarmListWidget     element={element} isDesignMode={isDesignMode} />;
    case 'alarmHistoryControl': return <AlarmHistoryWidget  element={element} isDesignMode={isDesignMode} />;
    case 'tableControl':        return <DataTableWidget     element={element} liveValues={liveValues} tags={tags} isDesignMode={isDesignMode} />;
    case 'barChartControl':     return <BarChartWidget      element={element} liveValues={liveValues} isDesignMode={isDesignMode} />;
    case 'webFrameControl':     return <WebFrameWidget      element={element} isDesignMode={isDesignMode} />;
    default:                    return null;
  }
};

export const isProcessPicture = (type) => [
  'trendControl', 'alarmControl', 'alarmHistoryControl',
  'tableControl', 'barChartControl', 'webFrameControl',
].includes(type);

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════
const thStyle = {
  padding: '5px 8px', textAlign: 'left', fontSize: '10px',
  fontWeight: 700, color: '#334155', borderBottom: '1px solid #E5E7EB',
  textTransform: 'uppercase', letterSpacing: '0.03em',
};

const tdStyle = {
  padding: '5px 8px', fontSize: '10px',
  borderBottom: '1px solid #F1F5F9',
};