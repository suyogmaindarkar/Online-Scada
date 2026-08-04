// ═══════════════════════════════════════════════════════════
// Trends Page — Historical Data Charts
//
// Task Bundle applied:
//   ✅ T004  — /trends/stats endpoint properly handled
//   ✅ T022  — Multi-tag overlay on same chart
//   ✅ T023  — CSV export with better formatting
//   ✅ T024  — Zoom/pan (implemented in TrendChart child)
//   ✅ T025  — Live scrolling chart mode
//   ✅ T026  — Statistics display (min/max/avg)
//   ✅ BONUS — Full blue theme rebrand
//   ✅ BONUS — Toast notifications instead of alerts
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import TrendChart from '../components/trends/TrendChart';
import TagSelector from '../components/trends/TagSelector';
import TimeRangeSelector from '../components/trends/TimeRangeSelector';
import StatsCard from '../components/trends/StatsCard';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  TrendingUp, RefreshCw, Download, Info, Play, Pause,
  BarChart3, Activity, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Blue theme chart colors (matches launching site brand palette) ───
const CHART_COLORS = [
  '#2563EB',  // brand-accent (blue)
  '#16A34A',  // success (green)
  '#DC2626',  // danger (red)
  '#F59E0B',  // warning (amber)
  '#9333EA',  // purple
  '#0891B2',  // cyan
  '#EA580C',  // orange
  '#0F3D91',  // brand-primary (deep blue)
];

// ─── Theme colors ───
const C = {
  bg:           '#F8FAFC',
  card:         '#FFFFFF',
  cardSubtle:   '#F8FAFC',
  cardHover:    '#EEF6FF',
  border:       '#E5E7EB',
  borderStrong: '#CBD5E1',
  heading:      '#081B43',
  text:         '#334155',
  muted:        '#5F6B7A',
  subtle:       '#94A3B8',
  brand:        '#2563EB',
  brandDark:    '#0F3D91',
  btnPrimary:   '#081B43',
  btnHover:     '#123E8A',
  success:      '#16A34A',
  warning:      '#F59E0B',
  danger:       '#DC2626',
};

const Trends = () => {
  const { showToast } = useToast();

  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [chartTags, setChartTags] = useState([]);
  const [selectedRange, setSelectedRange] = useState('1h');
  const [aggregation, setAggregation] = useState('10s');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isCustomRange, setIsCustomRange] = useState(false);
  const [customRangeParams, setCustomRangeParams] = useState(null);

  // ─── T025: Live scrolling mode ───
  const [liveMode, setLiveMode] = useState(false);
  const liveIntervalRef = useRef(null);

  // ═══════════════════════════════════════════════════════════
  // Load Available Tags
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await api.get('/tags');
        let tags = [];
        if (Array.isArray(response.data)) tags = response.data;
        else if (Array.isArray(response.data?.tags)) tags = response.data.tags;
        else if (Array.isArray(response.data?.data)) tags = response.data.data;
        setAvailableTags(tags);
      } catch (err) {
        console.error('Failed to fetch tags:', err);
        setError('Failed to load tags');
        setAvailableTags([]);
      }
    };
    fetchTags();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Fetch Trend Data (T022: multi-tag support)
  // ═══════════════════════════════════════════════════════════
  const fetchTrendData = useCallback(async (silent = false) => {
    if (selectedTags.length === 0) return;
    if (!silent) setIsLoading(true);
    setError('');

    try {
      let response;
      const tagIds = selectedTags.map((t) => t.tagId);

      if (isCustomRange && customRangeParams) {
        response = await api.post('/trends/history/custom', {
          tagIds,
          startTime: customRangeParams.startTime,
          endTime: customRangeParams.endTime,
          aggregation: customRangeParams.aggregation,
        });
      } else {
        response = await api.post('/trends/history/multiple', {
          tagIds,
          timeRange: selectedRange,
          aggregation,
        });
      }

      if (response.data?.success) {
        setChartTags(response.data.tags || []);
        setLastUpdated(new Date());

        // ─── T026: Fetch statistics for each tag ───
        const statsPromises = tagIds.map((tagId) =>
          api.get(`/trends/stats/${tagId}`, {
            params: { timeRange: selectedRange },
          })
            .then((r) => ({ tagId, stats: r.data?.stats || null }))
            .catch((err) => {
              console.warn(`Stats unavailable for tag ${tagId}:`, err.message);
              return { tagId, stats: null };
            })
        );

        const statsResults = await Promise.all(statsPromises);
        const statsMap = {};
        statsResults.forEach(({ tagId, stats }) => {
          statsMap[tagId] = stats;
        });
        setStats(statsMap);
      }
    } catch (err) {
      console.error('Fetch Trend Data Error:', err);
      if (err.response?.status !== 404) {
        const msg = err.response?.data?.message || 'Failed to fetch trend data';
        setError(msg);
        if (!silent) showToast(msg, 'error');
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [selectedTags, selectedRange, aggregation, isCustomRange, customRangeParams, showToast]);

  useEffect(() => {
    if (selectedTags.length > 0) fetchTrendData();
  }, [fetchTrendData]);

  // ═══════════════════════════════════════════════════════════
  // Auto-refresh interval
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!autoRefresh || selectedTags.length === 0) return;
    const interval = setInterval(() => fetchTrendData(true), refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchTrendData]);

  // ═══════════════════════════════════════════════════════════
  // T025: LIVE MODE — Rapid refresh (every 2s) + auto-scroll
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!liveMode || selectedTags.length === 0) {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
      return;
    }

    // Turn off other modes when live is on
    setAutoRefresh(false);
    setIsCustomRange(false);

    // Refresh every 2 seconds
    liveIntervalRef.current = setInterval(() => {
      fetchTrendData(true);
    }, 2000);

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [liveMode, selectedTags, fetchTrendData]);

  // ═══════════════════════════════════════════════════════════
  // Tag Handlers
  // ═══════════════════════════════════════════════════════════
  const handleTagSelect = (tag) => {
    if (selectedTags.length >= 8) {
      showToast('Maximum 8 tags allowed', 'warning');
      return;
    }
    setSelectedTags((prev) => [...prev, tag]);
    showToast(`Added: ${tag.tagName}`, 'success', 1500);
  };

  const handleTagRemove = (tagId) => {
    const removed = selectedTags.find((t) => t.tagId === tagId);
    setSelectedTags((prev) => prev.filter((t) => t.tagId !== tagId));
    if (removed) showToast(`Removed: ${removed.tagName}`, 'info', 1500);
  };

  const handleRangeChange = (range) => {
    setSelectedRange(range.value);
    setAggregation(range.aggregation);
    setIsCustomRange(false);
    setCustomRangeParams(null);
    // Live mode auto-switches to real-time range
    if (liveMode) setLiveMode(false);
  };

  const handleCustomRange = (params) => {
    setLiveMode(false); // Disable live mode when using custom range
    setIsCustomRange(true);
    setCustomRangeParams(params);
  };

  // ═══════════════════════════════════════════════════════════
  // T023: CSV Export — Enhanced formatting
  // ═══════════════════════════════════════════════════════════
  const handleExportCSV = () => {
    if (!chartTags.length) {
      showToast('No data to export', 'warning');
      return;
    }

    // Header row with tag names + units
    const headers = ['Timestamp', ...chartTags.map((t) =>
      t.unit ? `${t.tagName} (${t.unit})` : t.tagName
    )];

    // Build a time-indexed map
    const timeMap = {};
    chartTags.forEach((tag) => {
      tag.data?.forEach((point) => {
        if (!timeMap[point.time]) timeMap[point.time] = {};
        timeMap[point.time][tag.tagName] = point.value;
      });
    });

    // Sort rows chronologically
    const rows = Object.entries(timeMap)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([time, values]) => [
        new Date(time).toISOString(),
        ...chartTags.map((t) => {
          const v = values[t.tagName];
          return v !== undefined && v !== null ? v.toFixed(4) : '';
        }),
      ]);

    // Add metadata header (as comments)
    const metadata = [
      `# OnlineSCADA Trend Export`,
      `# Generated: ${new Date().toISOString()}`,
      `# Time Range: ${isCustomRange ? 'Custom' : selectedRange}`,
      `# Aggregation: ${aggregation}`,
      `# Total Tags: ${chartTags.length}`,
      `# Total Points: ${rows.length}`,
      ``,
    ].join('\n');

    const csvContent = metadata +
      [headers, ...rows].map((row) => row.map((cell) => {
        // Escape cells containing commas or quotes
        const s = String(cell);
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trend_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${rows.length} data points to CSV`, 'success');
  };

  // ═══════════════════════════════════════════════════════════
  // T025: Toggle Live Mode
  // ═══════════════════════════════════════════════════════════
  const toggleLiveMode = () => {
    if (selectedTags.length === 0) {
      showToast('Select at least one tag first', 'warning');
      return;
    }
    const newMode = !liveMode;
    setLiveMode(newMode);
    if (newMode) {
      showToast('🔴 Live mode activated (2s refresh)', 'success');
    } else {
      showToast('Live mode stopped', 'info');
    }
  };

  // Total data points (memoize-friendly inline)
  const totalDataPoints = chartTags.reduce((acc, t) => acc + (t.data?.length || 0), 0);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER CARD ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Title + Logo */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.30)',
              }}
            >
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{
                  color: C.heading,
                  fontFamily: "'Montserrat', sans-serif",
                  letterSpacing: '-0.01em',
                }}
              >
                Trend Viewer
              </h1>
              <p className="text-sm" style={{ color: C.muted }}>
                Historical data analysis & real-time charts
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Last updated */}
            {lastUpdated && (
              <span className="text-xs mr-2" style={{ color: C.subtle }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            {/* T025: LIVE MODE toggle */}
            <button
              onClick={toggleLiveMode}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: liveMode ? C.danger : C.cardSubtle,
                color: liveMode ? '#FFFFFF' : C.text,
                border: `1px solid ${liveMode ? C.danger : C.border}`,
                boxShadow: liveMode ? '0px 2px 8px rgba(220, 38, 38, 0.30)' : 'none',
              }}
              title={liveMode ? 'Stop live scrolling' : 'Start live scrolling (2s refresh)'}
            >
              {liveMode ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  LIVE
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Go Live
                </>
              )}
            </button>

            {/* Auto refresh (only when not live) */}
            {!liveMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: autoRefresh ? C.success : C.cardSubtle,
                    color: autoRefresh ? '#FFFFFF' : C.text,
                    border: `1px solid ${autoRefresh ? C.success : C.border}`,
                  }}
                  title={autoRefresh ? 'Auto refresh ON' : 'Auto refresh OFF'}
                >
                  {autoRefresh ? '● Auto' : '○ Auto'}
                </button>
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      background: C.card,
                      color: C.heading,
                      border: `1px solid ${C.border}`,
                    }}
                    onFocus={(e) => { e.target.style.borderColor = C.brand; }}
                    onBlur={(e) => { e.target.style.borderColor = C.border; }}
                  >
                    <option value={10}>10s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1m</option>
                    <option value={300}>5m</option>
                  </select>
                )}
              </div>
            )}

            {/* Manual refresh */}
            <button
              onClick={() => fetchTrendData()}
              disabled={isLoading || selectedTags.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: C.btnPrimary,
                color: '#FFFFFF',
                boxShadow: '0px 2px 8px rgba(8, 27, 67, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = C.btnHover;
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = C.btnPrimary;
              }}
              title="Refresh data now"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={!chartTags.length}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: C.success,
                color: '#FFFFFF',
                boxShadow: '0px 2px 8px rgba(22, 163, 74, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = '#15803D';
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.disabled) e.currentTarget.style.background = C.success;
              }}
              title="Export chart data as CSV file"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════ ERROR BANNER ═══════════ */}
      {error && (
        <div
          className="p-4 rounded-lg flex items-center gap-2 font-medium"
          style={{
            background: '#FEE2E2',
            border: `1px solid ${C.danger}`,
            color: '#B91C1C',
          }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ═══════════ MAIN LAYOUT ═══════════ */}
      <div className="grid grid-cols-12 gap-4">
        {/* ─── LEFT SIDEBAR ─── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <TagSelector
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagSelect={handleTagSelect}
            onTagRemove={handleTagRemove}
            maxTags={8}
          />

          <TimeRangeSelector
            selectedRange={selectedRange}
            onRangeChange={handleRangeChange}
            onCustomRange={handleCustomRange}
            isLoading={isLoading}
            disabled={liveMode}
          />

          {/* ─── Chart Info Card ─── */}
          <div
            className="p-4 rounded-2xl"
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
            }}
          >
            <h3
              className="font-bold mb-3 flex items-center gap-2 text-sm"
              style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
            >
              <Info className="w-4 h-4" style={{ color: C.brand }} />
              Chart Info
            </h3>
            <div className="space-y-2 text-sm">
              {[
                ['Data Points', totalDataPoints.toLocaleString()],
                ['Tags', selectedTags.length],
                ['Range', isCustomRange ? 'Custom' : liveMode ? 'Live' : selectedRange],
                ['Aggregation', aggregation],
                ['Mode', liveMode ? '🔴 Live' : autoRefresh ? '🟢 Auto' : '⏸ Manual'],
              ].map(([label, value], idx, arr) => (
                <div
                  key={label}
                  className="flex justify-between py-1"
                  style={{
                    borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <span style={{ color: C.muted }}>{label}:</span>
                  <span className="font-semibold" style={{ color: C.heading }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Selected Tags Legend ─── */}
          {selectedTags.length > 0 && (
            <div
              className="p-4 rounded-2xl"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
              }}
            >
              <h3
                className="font-bold mb-3 flex items-center gap-2 text-sm"
                style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
              >
                <BarChart3 className="w-4 h-4" style={{ color: C.brand }} />
                Legend
              </h3>
              <div className="space-y-2">
                {selectedTags.map((tag, index) => (
                  <div key={tag.tagId} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded flex-shrink-0"
                      style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span
                      className="font-medium truncate flex-1"
                      style={{ color: C.text }}
                      title={tag.tagName}
                    >
                      {tag.tagName}
                    </span>
                    {tag.unit && (
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: C.subtle }}
                      >
                        {tag.unit}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT CHART AREA ─── */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {/* Loading State */}
          {isLoading && !liveMode && (
            <div
              className="p-4 flex items-center justify-center rounded-2xl"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
                height: '480px',
              }}
            >
              <div className="text-center">
                <Loader2
                  className="w-12 h-12 animate-spin mx-auto mb-3"
                  style={{ color: C.brand }}
                />
                <p className="font-medium" style={{ color: C.muted }}>
                  Loading trend data...
                </p>
              </div>
            </div>
          )}

          {/* Chart */}
          {!isLoading && selectedTags.length > 0 && (
            <div
              className="p-4 rounded-2xl"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
              }}
            >
              {/* Chart header with live indicator */}
              {liveMode && (
                <div className="flex items-center gap-2 mb-3 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: C.danger }}></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: C.danger }}></span>
                  </span>
                  <span className="text-sm font-bold" style={{ color: C.danger, fontFamily: "'Montserrat', sans-serif" }}>
                    LIVE
                  </span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    Refreshing every 2 seconds
                  </span>
                </div>
              )}

              <TrendChart
                tags={chartTags}
                height={liveMode ? 380 : 420}
                showBrush={!liveMode}
                showGrid={true}
                darkMode={false}
                liveMode={liveMode}
                colors={CHART_COLORS}
              />
            </div>
          )}

          {/* ─── T026: Statistics Grid ─── */}
          {selectedTags.length > 0 && Object.keys(stats).length > 0 && (
            <div>
              <h3
                className="font-bold mb-3 flex items-center gap-2"
                style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
              >
                <Activity className="w-5 h-5" style={{ color: C.brand }} />
                Statistics
                <span
                  className="text-xs font-normal px-2 py-0.5 rounded"
                  style={{
                    background: C.cardHover,
                    color: C.brand,
                    fontFamily: 'monospace',
                  }}
                >
                  {isCustomRange ? 'custom range' : selectedRange}
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedTags.map((tag, index) => (
                  <StatsCard
                    key={tag.tagId}
                    stats={stats[tag.tagId]}
                    tagName={tag.tagName}
                    unit={tag.unit}
                    color={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ─── Empty State ─── */}
          {!isLoading && selectedTags.length === 0 && (
            <div
              className="flex items-center justify-center rounded-2xl"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
                height: '480px',
              }}
            >
              <div className="text-center px-6">
                <div
                  className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
                  style={{ background: C.cardHover }}
                >
                  <TrendingUp className="w-10 h-10" style={{ color: C.brand }} />
                </div>
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
                >
                  No Tags Selected
                </h3>
                <p className="text-sm max-w-md" style={{ color: C.muted }}>
                  Select up to 8 tags from the left panel to view historical trend charts.
                  Use the <strong style={{ color: C.brand }}>Live</strong> button for real-time streaming.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trends;