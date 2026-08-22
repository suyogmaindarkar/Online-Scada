// ═══════════════════════════════════════════════════════════
// Dashboard — Blue theme + full task bundle
//
// Task Bundle applied:
//   ✅ T005  — Fix stats showing 0 on load (proper loading state)
//   ✅ T027  — PLC status widgets (per-PLC card list with health info)
//   ✅ T028  — Recent alarms feed (last 10 triggered, click to nav)
//   ✅ T029  — Live trend mini-charts (SVG sparklines for top numeric tags)
//   ✅ UI FIX — Removed header icon badge for clean left-alignment
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { plcAPI, tagAPI, alarmAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import {
  Cpu, Tag, Bell, Activity, TrendingUp, AlertCircle, RefreshCw, Loader2,
  Wifi, WifiOff, ChevronRight, BarChart3, Clock, ShieldAlert,
  Bell as BellIcon,
} from 'lucide-react';

// ─── Theme ───
const C = {
  bg:         '#F8FAFC',
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
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
  purple:     '#9333EA',
};

// ─── Priority colors ───
const PRIORITY_COLORS = {
  CRITICAL: '#DC2626',
  HIGH:     '#EA580C',
  MEDIUM:   '#F59E0B',
  LOW:      '#2563EB',
};

// ─── Max points to keep in sparkline history ───
const SPARKLINE_HISTORY_SIZE = 30;

const Dashboard = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // ─── State ───
  const [stats, setStats] = useState({
    totalPLCs: 0,
    onlinePLCs: 0,
    totalTags: 0,
    activeAlarms: 0,
  });
  const [plcs, setPlcs] = useState([]);              // T027
  const [tags, setTags] = useState([]);              // For sparkline metadata
  const [recentAlarms, setRecentAlarms] = useState([]); // T028
  const [liveTags, setLiveTags] = useState({});
  const [validTagNames, setValidTagNames] = useState(new Set());
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errors, setErrors] = useState([]);

  // ─── T029: Sparkline history (per tag) ───
  const [sparklineData, setSparklineData] = useState({});
  const sparklineRef = useRef({});

  const refreshIntervalRef = useRef(null);

  // ═══════════════════════════════════════════════════════════
  // ✅ T005: Load stats — only set loading=false AFTER first data arrives
  // ═══════════════════════════════════════════════════════════
  const loadStats = async (isInitial = false, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);

    try {
      const results = await Promise.allSettled([
        plcAPI.getAll(),
        tagAPI.getAll(),
        alarmAPI.getActiveAlarms(),
        alarmAPI.getHistory({ limit: 10 }),  // T028: recent alarms
      ]);

      const errors = [];
      let plcs = [];
      let tags = [];
      let activeAlarms = [];
      let historyAlarms = [];

      if (results[0].status === 'fulfilled') {
        plcs = results[0].value?.data?.data || [];
      } else {
        errors.push('PLCs');
        console.error('PLC API error:', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        tags = results[1].value?.data?.data || [];
      } else {
        errors.push('Tags');
        console.error('Tag API error:', results[1].reason);
      }

      if (results[2].status === 'fulfilled') {
        const alarmData = results[2].value?.data;
        activeAlarms = alarmData?.alarms || alarmData?.data || [];
      } else {
        errors.push('Alarms');
        console.error('Alarm API error:', results[2].reason);
      }

      if (results[3].status === 'fulfilled') {
        const historyData = results[3].value?.data;
        historyAlarms = historyData?.alarms || historyData?.data || [];
      }

      setStats({
        totalPLCs: plcs.length,
        onlinePLCs: plcs.filter((p) => p.isConnected).length,
        totalTags: tags.length,
        activeAlarms: activeAlarms.length,
      });

      setPlcs(plcs);      // T027
      setTags(tags);
      setRecentAlarms(historyAlarms); // T028

      const validNames = new Set(tags.map((t) => t.tagName));
      setValidTagNames(validNames);

      // Clean up live tags — remove tags that no longer exist
      setLiveTags((prev) => {
        const cleaned = {};
        Object.keys(prev).forEach((tagName) => {
          if (validNames.has(tagName)) cleaned[tagName] = prev[tagName];
        });
        return cleaned;
      });

      setErrors(errors);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Unexpected loadStats error:', error);
      setErrors(['Unknown error']);
    } finally {
      if (isInitial) setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats(true);

    socketService.connect();

    if (socketService.isConnected && socketService.isConnected()) {
      setConnected(true);
    }

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    const handleTagsUpdate = (updates) => {
      if (!Array.isArray(updates)) return;

      setLiveTags((prev) => {
        const next = { ...prev };
        updates.forEach((u) => {
          if (!u || !u.tagName) return;
          next[u.tagName] = {
            tagName: u.tagName,
            value: u.value,
            quality: u.quality || 'GOOD',
            timestamp: u.timestamp || Date.now(),
          };
        });
        return next;
      });

      updates.forEach((u) => {
        if (!u || !u.tagName || typeof u.value !== 'number') return;
        const history = sparklineRef.current[u.tagName] || [];
        history.push({ time: Date.now(), value: u.value });
        if (history.length > SPARKLINE_HISTORY_SIZE) {
          history.shift();
        }
        sparklineRef.current[u.tagName] = history;
      });

      setSparklineData({ ...sparklineRef.current });
    };

    const handlePlcStatus = (data) => {
      setPlcs((prev) =>
        prev.map((p) =>
          p._id === data.plcId ? { ...p, isConnected: data.isConnected } : p
        )
      );
      setStats((prev) => ({
        ...prev,
        onlinePLCs: data.isConnected
          ? Math.min(prev.onlinePLCs + (prev.onlinePLCs < prev.totalPLCs ? 1 : 0), prev.totalPLCs)
          : Math.max(0, prev.onlinePLCs - 1),
      }));
    };

    const handleAlarmEvent = () => loadStats(false);

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('tagsUpdate', handleTagsUpdate);
    socketService.on('plcStatus', handlePlcStatus);
    socketService.on('alarmTriggered', handleAlarmEvent);
    socketService.on('alarmCleared', handleAlarmEvent);

    refreshIntervalRef.current = setInterval(() => loadStats(false), 10000);

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('tagsUpdate', handleTagsUpdate);
      socketService.off('plcStatus', handlePlcStatus);
      socketService.off('alarmTriggered', handleAlarmEvent);
      socketService.off('alarmCleared', handleAlarmEvent);
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const tagList = Object.values(liveTags)
    .filter((t) => validTagNames.has(t.tagName))
    .sort((a, b) => a.tagName.localeCompare(b.tagName));

  const sparklineTags = Object.entries(sparklineData)
    .filter(([name, hist]) => validTagNames.has(name) && hist.length >= 2)
    .slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 rounded animate-pulse" style={{ background: C.border }} />
            <div className="h-4 w-64 rounded animate-pulse mt-2" style={{ background: C.border }} />
          </div>
          <div className="h-10 w-32 rounded animate-pulse" style={{ background: C.border }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-6 rounded-2xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-lg animate-pulse" style={{ background: C.border }} />
                <div className="w-6 h-6 rounded animate-pulse" style={{ background: C.border }} />
              </div>
              <div className="h-4 w-24 rounded animate-pulse mb-2" style={{ background: C.border }} />
              <div className="h-9 w-16 rounded animate-pulse" style={{ background: C.border }} />
            </div>
          ))}
        </div>
        <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: C.brand }} />
            <span className="ml-3" style={{ color: C.muted }}>Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* ✅ UI FIX: Removed the icon container, kept cleanly left-aligned text */}
        <div>
          <h1
            className="text-3xl font-bold"
            style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif", letterSpacing: '-0.02em' }}
          >
            Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            Overview of your OnlineSCADA system
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdated && (
            <span className="text-xs mr-2" style={{ color: C.subtle }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={() => loadStats(false, true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: C.card, color: C.text, border: `1px solid ${C.border}` }}
            onMouseEnter={(e) => { if (!refreshing) e.currentTarget.style.background = C.cardHover; }}
            onMouseLeave={(e) => { if (!refreshing) e.currentTarget.style.background = C.card; }}
            title="Refresh dashboard"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>

          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: connected ? '#DCFCE7' : '#FEE2E2',
              border: `1px solid ${connected ? C.success : C.danger}`,
            }}
          >
            <div className="relative flex items-center justify-center">
              <div
                className="absolute w-3 h-3 rounded-full animate-ping"
                style={{ background: connected ? C.success : C.danger, opacity: 0.4 }}
              />
              <div
                className="w-2 h-2 rounded-full relative"
                style={{ background: connected ? C.success : C.danger }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: connected ? '#15803D' : '#B91C1C' }}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ background: '#FFEDD5', border: `1px solid ${C.warning}`, color: '#7C2D12' }}
        >
          <AlertCircle size={16} />
          Failed to load: {errors.join(', ')}. Other data is still current.
        </div>
      )}

      {/* ═══════════ STAT CARDS ═══════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total PLCs" value={stats.totalPLCs} icon={Cpu} color={C.brand} onClick={() => navigate('/plc')} />
        <StatCard label="Online PLCs" value={stats.onlinePLCs} subValue={stats.totalPLCs > 0 ? `${Math.round((stats.onlinePLCs / stats.totalPLCs) * 100)}%` : null} icon={Activity} color={C.success} onClick={() => navigate('/plc')} />
        <StatCard label="Total Tags" value={stats.totalTags} icon={Tag} color={C.purple} onClick={() => navigate('/tags')} />
        <StatCard label="Active Alarms" value={stats.activeAlarms} icon={Bell} color={stats.activeAlarms > 0 ? C.danger : C.success} onClick={() => navigate('/alarms')} pulse={stats.activeAlarms > 0} />
      </div>

      {/* ═══════════ MAIN GRID ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Widget title="PLC Status" subtitle={`${stats.onlinePLCs} of ${stats.totalPLCs} online`} icon={Cpu} iconColor={C.brand} onSeeAll={() => navigate('/plc')}>
          {plcs.length === 0 ? (
            <EmptyState icon={Cpu} label="No PLCs configured" hint="Add a PLC in PLC Management" />
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {plcs.slice(0, 8).map((plc) => (
                <PLCCard key={plc._id} plc={plc} onClick={() => navigate('/plc')} />
              ))}
              {plcs.length > 8 && (
                <button
                  onClick={() => navigate('/plc')}
                  className="w-full py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{ color: C.brand, background: C.cardSubtle }}
                >
                  View all {plcs.length} PLCs →
                </button>
              )}
            </div>
          )}
        </Widget>

        <Widget title="Live Tag Updates" subtitle={`${tagList.length} ${tagList.length === 1 ? 'tag' : 'tags'} streaming`} icon={Activity} iconColor={C.brand} iconAnimated={tagList.length > 0} onSeeAll={() => navigate('/tags')}>
          {tagList.length === 0 ? (
            <EmptyState icon={AlertCircle} label="No live data yet" hint="Start a PLC to see updates" />
          ) : (
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto">
              {tagList.slice(0, 12).map((tag) => (
                <LiveTagRow key={tag.tagName} tag={tag} />
              ))}
              {tagList.length > 12 && (
                <button
                  onClick={() => navigate('/tags')}
                  className="w-full py-2 text-xs font-semibold rounded-lg transition-colors"
                  style={{ color: C.brand, background: C.cardSubtle }}
                >
                  View all {tagList.length} tags →
                </button>
              )}
            </div>
          )}
        </Widget>

        <Widget title="Recent Alarms" subtitle={`${recentAlarms.length} in history`} icon={BellIcon} iconColor={stats.activeAlarms > 0 ? C.danger : C.brand} iconAnimated={stats.activeAlarms > 0} onSeeAll={() => navigate('/alarms')}>
          {recentAlarms.length === 0 ? (
            <EmptyState icon={ShieldAlert} label="All systems normal" hint="No alarms in history" />
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {recentAlarms.slice(0, 10).map((alarm) => (
                <AlarmRow key={alarm._id} alarm={alarm} onClick={() => navigate('/alarms')} />
              ))}
            </div>
          )}
        </Widget>
      </div>

      {/* ═══════════ LIVE TREND MINI-CHARTS ═══════════ */}
      {sparklineTags.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={20} style={{ color: C.brand }} />
            <h2 className="text-lg font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
              Live Trends
            </h2>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold" style={{ background: C.cardHover, color: C.brand }}>
              real-time
            </span>
            <button
              onClick={() => navigate('/trends')}
              className="ml-auto text-sm font-semibold flex items-center gap-1 transition-colors"
              style={{ color: C.brand }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.brandDark; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.brand; }}
            >
              Full Trends View
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sparklineTags.map(([tagName, history], idx) => {
              const tag = tags.find((t) => t.tagName === tagName);
              const currentValue = history[history.length - 1]?.value;
              const previousValue = history[history.length - 2]?.value;
              const trend =
                currentValue !== undefined && previousValue !== undefined
                  ? currentValue > previousValue ? 'up'
                  : currentValue < previousValue ? 'down' : 'flat'
                  : 'flat';

              const values = history.map((h) => h.value);
              const min = Math.min(...values);
              const max = Math.max(...values);

              return (
                <MiniTrendCard
                  key={tagName} tagName={tagName} unit={tag?.unit || ''} currentValue={currentValue}
                  trend={trend} history={history} min={min} max={max}
                  color={[C.brand, C.success, C.purple, C.warning][idx % 4]}
                  onClick={() => navigate('/trends')}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const StatCard = ({ label, value, subValue, icon: Icon, color, onClick, pulse = false }) => (
  <button
    onClick={onClick}
    className="p-5 rounded-2xl text-left transition-all"
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
      cursor: 'pointer',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0px 12px 40px rgba(8, 27, 67, 0.12)';
      e.currentTarget.style.borderColor = color;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0px 4px 20px rgba(8, 27, 67, 0.06)';
      e.currentTarget.style.borderColor = C.border;
    }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="p-3 rounded-xl" style={{ background: `${color}15` }}>
        <Icon className={`w-6 h-6 ${pulse ? 'animate-pulse' : ''}`} style={{ color }} />
      </div>
      <TrendingUp className="w-4 h-4" style={{ color: C.subtle }} />
    </div>
    <p className="text-sm mb-1 font-medium" style={{ color: C.muted }}>{label}</p>
    <div className="flex items-baseline gap-2">
      <p className="text-3xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
        {value}
      </p>
      {subValue && (
        <span className="text-sm font-semibold" style={{ color }}>
          {subValue}
        </span>
      )}
    </div>
  </button>
);

const Widget = ({ title, subtitle, icon: Icon, iconColor, iconAnimated, onSeeAll, children }) => (
  <div
    className="rounded-2xl p-5"
    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className={`w-5 h-5 ${iconAnimated ? 'animate-pulse' : ''}`} style={{ color: iconColor }} />
        <div>
          <h3 className="text-base font-bold leading-tight" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>{title}</h3>
          <p className="text-xs mt-0.5" style={{ color: C.subtle }}>{subtitle}</p>
        </div>
      </div>
      {onSeeAll && (
        <button
          onClick={onSeeAll}
          className="text-xs font-semibold flex items-center gap-1 transition-colors"
          style={{ color: C.brand }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.brandDark; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.brand; }}
        >
          See all <ChevronRight size={12} />
        </button>
      )}
    </div>
    {children}
  </div>
);

const PLCCard = ({ plc, onClick }) => {
  const isOnline = plc.isConnected;
  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg text-left transition-all group"
      style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, cursor: 'pointer' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; e.currentTarget.style.borderColor = C.brand; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = C.cardSubtle; e.currentTarget.style.borderColor = C.border; }}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isOnline ? '#DCFCE7' : '#FEE2E2' }}>
          {isOnline ? <Wifi className="w-4 h-4" style={{ color: C.success }} /> : <WifiOff className="w-4 h-4" style={{ color: C.danger }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate" style={{ color: C.heading }} title={plc.name}>{plc.name}</p>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0" style={{ background: C.cardHover, color: C.brand }}>
              {plc.protocol}
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>
            {plc.ipAddress}:{plc.port}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isOnline ? C.success : C.danger }}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {plc.tagCount !== undefined && (
            <p className="text-[10px] mt-0.5" style={{ color: C.subtle }}>{plc.tagCount} tags</p>
          )}
        </div>
      </div>
    </button>
  );
};

const LiveTagRow = ({ tag }) => {
  const isGood = tag.quality === 'GOOD';
  const formatValue = (v) => {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
    return String(v);
  };
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg transition-colors" style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isGood ? '' : 'animate-pulse'}`} style={{ background: isGood ? C.success : C.danger }} />
        <span className="font-mono text-xs truncate" style={{ color: C.heading, fontWeight: 500 }} title={tag.tagName}>{tag.tagName}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="font-mono font-bold text-sm" style={{ color: typeof tag.value === 'boolean' ? (tag.value ? C.success : C.danger) : C.brand }}>
          {formatValue(tag.value)}
        </span>
        <span className="text-[10px]" style={{ color: C.subtle }}>{new Date(tag.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

const AlarmRow = ({ alarm, onClick }) => {
  const color = PRIORITY_COLORS[alarm.priority] || C.brand;
  return (
    <button
      onClick={onClick}
      className="w-full p-2.5 rounded-lg text-left transition-all"
      style={{
        background: C.cardSubtle, borderLeft: `3px solid ${color}`, border: `1px solid ${C.border}`, borderLeftWidth: '3px', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.cardHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = C.cardSubtle; }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: `${color}20`, color }}>{alarm.priority}</span>
            <p className="text-xs font-semibold truncate" style={{ color: C.heading }} title={alarm.alarmName}>{alarm.alarmName}</p>
          </div>
          <p className="text-[11px] truncate" style={{ color: C.muted }} title={alarm.message}>{alarm.message || alarm.tag}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 text-[10px]" style={{ color: C.subtle }}>
            <Clock size={9} />
            {alarm.triggeredAt || alarm.timestamp ? new Date(alarm.triggeredAt || alarm.timestamp).toLocaleTimeString() : '—'}
          </div>
          {alarm.event && (
            <span className="text-[9px] font-semibold uppercase" style={{ color: alarm.event === 'CLEARED' ? C.success : color }}>{alarm.event}</span>
          )}
        </div>
      </div>
    </button>
  );
};

const MiniTrendCard = ({ tagName, unit, currentValue, trend, history, min, max, color, onClick }) => {
  const chartWidth = 200, chartHeight = 50, padding = 4;
  const range = max - min || 1;
  const points = history.map((h, i) => {
    const x = padding + (i / (history.length - 1)) * (chartWidth - padding * 2);
    const y = padding + (1 - (h.value - min) / range) * (chartHeight - padding * 2);
    return `${x},${y}`;
  });
  const pathData = `M ${points.join(' L ')}`;
  const areaData = `M ${points[0]} L ${points.join(' L ')} L ${chartWidth - padding},${chartHeight - padding} L ${padding},${chartHeight - padding} Z`;

  const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—';
  const trendColor = trend === 'up' ? C.success : trend === 'down' ? C.danger : C.subtle;

  return (
    <button
      onClick={onClick}
      className="p-4 rounded-2xl text-left transition-all"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)', cursor: 'pointer' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0px 8px 24px ${color}20`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = '0px 4px 20px rgba(8, 27, 67, 0.04)'; }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: C.muted }} title={tagName}>{tagName}</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold" style={{ color, fontFamily: 'monospace' }}>
              {typeof currentValue === 'number' ? Number.isInteger(currentValue) ? currentValue : currentValue.toFixed(2) : '—'}
            </span>
            {unit && <span className="text-[10px]" style={{ color: C.subtle }}>{unit}</span>}
          </div>
        </div>
        <span className="text-lg font-bold" style={{ color: trendColor }} title={`Trend: ${trend}`}>{trendIcon}</span>
      </div>
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`grad-${tagName}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaData} fill={`url(#grad-${tagName})`} />
        <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.length > 0 && (
          <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r="3" fill={color} stroke={C.card} strokeWidth="2" />
        )}
      </svg>
      <div className="flex justify-between text-[10px] mt-1" style={{ color: C.subtle }}>
        <span>min: {min.toFixed(2)}</span>
        <span>{history.length} pts</span>
        <span>max: {max.toFixed(2)}</span>
      </div>
    </button>
  );
};

const EmptyState = ({ icon: Icon, label, hint }) => (
  <div className="text-center py-8">
    <Icon className="w-10 h-10 mx-auto mb-3" style={{ color: C.subtle }} />
    <p className="text-sm font-medium" style={{ color: C.muted }}>{label}</p>
    {hint && <p className="text-xs mt-1" style={{ color: C.subtle }}>{hint}</p>}
  </div>
);

export default Dashboard;