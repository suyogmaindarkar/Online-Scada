// ═══════════════════════════════════════════════════════════
// Alarms Page — Blue theme + full task bundle
//
// Task Bundle applied:
//   ✅ T018  — Real audio file playback (now GLOBAL via AlarmNotificationContext)
//   ✅ T019  — Email UI for recipients
//   ✅ T020  — Priority filter chips + color-coded rows
//   ✅ T021  — Server-side CSV export
//   ✅ GLOBAL_SOUND — Sound now plays from any page (not just Alarms)
//   ✅ UI FIX — Removed header icon badge for clean left-alignment
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { alarmAPI, tagAPI, settingsAPI } from '../services/api';
import socketService from '../services/socket';
import { useToast } from '../context/ToastContext';
import { useAlarmNotification } from '../context/AlarmNotificationContext'; // ✅ NEW
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  Bell, BellRing, AlertTriangle, CheckCircle, Clock,
  Plus, Edit2, Trash2, History, ShieldAlert,
  Volume2, VolumeX, RefreshCw, Loader2, Download,
  Mail, X, Filter,
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
  btnPrimary: '#2563EB',
  btnHover:   '#1D4ED8',
  success:    '#16A34A',
  warning:    '#F59E0B',
  danger:     '#DC2626',
};

// ─── T020: Priority style config ───
const PRIORITY_STYLES = {
  CRITICAL: { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D', dot: '#DC2626', icon: '🔴', order: 4 },
  HIGH:     { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12', dot: '#EA580C', icon: '🟠', order: 3 },
  MEDIUM:   { bg: '#FEF3C7', border: '#F59E0B', text: '#78350F', dot: '#F59E0B', icon: '🟡', order: 2 },
  LOW:      { bg: '#DBEAFE', border: '#2563EB', text: '#1E40AF', dot: '#2563EB', icon: '🔵', order: 1 },
};

const getPriorityStyle = (p) => PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM;

const Alarms = () => {
  const { showToast } = useToast();

  // ✅ NEW: Use global alarm notification state (replaces local sound state)
  const { soundEnabled, setSoundEnabled, soundVolume, testSound } = useAlarmNotification();

  const [activeTab, setActiveTab] = useState('active');
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [allAlarms, setAllAlarms] = useState([]);
  const [history, setHistory] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [showAckAllConfirm, setShowAckAllConfirm] = useState(false);
  const [error, setError] = useState(null);

  // ─── T020: Priority filter ───
  const [priorityFilter, setPriorityFilter] = useState(null); // null = all

  // ─── T021: Export ───
  const [exporting, setExporting] = useState(false);

  const [formData, setFormData] = useState(initialForm());

  function initialForm() {
    return {
      alarmName: '',
      description: '',
      tag: '',
      alarmType: 'HIGH',
      setpoint: 0,
      deadband: 0,
      priority: 'MEDIUM',
      message: '',
      group: 'Default',
      // T018 + T019
      soundEnabled: true,
      enableEmail: false,
      emailRecipients: [],
      emailThrottleMinutes: 15,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // Load data
  // ═══════════════════════════════════════════════════════════
  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const [activeRes, allRes, historyRes, tagRes] = await Promise.all([
        alarmAPI.getActive().catch(() => ({ data: { alarms: [] } })),
        alarmAPI.getAll().catch(() => ({ data: { alarms: [] } })),
        alarmAPI.getHistory({ limit: 200 }).catch(() => ({ data: { alarms: [] } })),
        tagAPI.getAll().catch(() => ({ data: { data: [] } })),
      ]);

      setActiveAlarms(activeRes?.data?.alarms || []);
      setAllAlarms(allRes?.data?.alarms || []);
      setHistory(historyRes?.data?.alarms || []);
      setTags(tagRes?.data?.data || []);
    } catch (err) {
      console.error('Failed to load alarms:', err);
      setError(err.response?.data?.message || 'Failed to load alarms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Real-time socket events — ONLY reload data
  // (Sound + toast + browser notif handled by GLOBAL provider)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    loadData();

    // ✅ SIMPLIFIED: Only reload data here — no sound/toast (global handler does it)
    const handleAlarmTriggered = () => loadData(true);
    const handleAlarmCleared = () => loadData(true);
    const handleAlarmAcked = () => loadData(true);

    socketService.on('alarmTriggered', handleAlarmTriggered);
    socketService.on('alarmCleared', handleAlarmCleared);
    socketService.on('alarmAcknowledged', handleAlarmAcked);

    const interval = setInterval(() => loadData(true), 10000);

    return () => {
      socketService.off('alarmTriggered', handleAlarmTriggered);
      socketService.off('alarmCleared', handleAlarmCleared);
      socketService.off('alarmAcknowledged', handleAlarmAcked);
      clearInterval(interval);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Alarm actions
  // ═══════════════════════════════════════════════════════════
  const handleAcknowledge = async (id) => {
    try {
      await alarmAPI.acknowledge(id);
      loadData(true);
      showToast('Alarm acknowledged', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to acknowledge', 'error');
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await alarmAPI.acknowledgeAll();
      loadData(true);
      showToast('All alarms acknowledged', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to acknowledge all', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ T021: Export CSV (server-side, with priority filter)
  // ═══════════════════════════════════════════════════════════
  const handleExportCSV = async (type = 'all') => {
    try {
      setExporting(true);
      const params = new URLSearchParams({ type });
      if (priorityFilter) params.append('priority', priorityFilter);

      const token = localStorage.getItem('token');
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/alarms/export?${params}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `alarms_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast(`Exported ${type} alarms to CSV`, 'success');
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Modal helpers
  // ═══════════════════════════════════════════════════════════
  const handleOpenAdd = () => {
    setEditingAlarm(null);
    setFormData(initialForm());
    setShowModal(true);
  };

  const handleOpenEdit = (alarm) => {
    setEditingAlarm(alarm);
    setFormData({
      alarmName: alarm.alarmName,
      description: alarm.description || '',
      tag: alarm.tag,
      alarmType: alarm.alarmType,
      setpoint: alarm.setpoint,
      deadband: alarm.deadband,
      priority: alarm.priority,
      message: alarm.message || '',
      group: alarm.group,
      soundEnabled: alarm.soundEnabled !== false,
      enableEmail: alarm.enableEmail || false,
      emailRecipients: alarm.emailRecipients || [],
      emailThrottleMinutes: alarm.emailThrottleMinutes ?? 15,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingAlarm) {
        await alarmAPI.update(editingAlarm._id, formData);
        showToast('Alarm updated successfully', 'success');
      } else {
        await alarmAPI.create(formData);
        showToast('Alarm created successfully', 'success');
      }
      setShowModal(false);
      loadData(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await alarmAPI.delete(deleteId);
      setDeleteId(null);
      loadData(true);
      showToast('Alarm deleted', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) : value,
    });
  };

  // Email recipients helpers
  const addEmailRecipient = (email) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast('Invalid email address', 'warning');
      return;
    }
    if (formData.emailRecipients.includes(trimmed)) {
      showToast('Email already added', 'info');
      return;
    }
    setFormData({ ...formData, emailRecipients: [...formData.emailRecipients, trimmed] });
  };

  const removeEmailRecipient = (email) => {
    setFormData({
      ...formData,
      emailRecipients: formData.emailRecipients.filter((e) => e !== email),
    });
  };

  // ═══════════════════════════════════════════════════════════
  // Filtered lists (T020)
  // ═══════════════════════════════════════════════════════════
  const filteredActiveAlarms = priorityFilter
    ? activeAlarms.filter((a) => a.priority === priorityFilter)
    : activeAlarms;

  const filteredAllAlarms = priorityFilter
    ? allAlarms.filter((a) => a.priority === priorityFilter)
    : allAlarms;

  const filteredHistory = priorityFilter
    ? history.filter((a) => a.priority === priorityFilter)
    : history;

  const stats = {
    total: activeAlarms.length,
    critical: activeAlarms.filter((a) => a.priority === 'CRITICAL').length,
    high: activeAlarms.filter((a) => a.priority === 'HIGH').length,
    medium: activeAlarms.filter((a) => a.priority === 'MEDIUM').length,
    low: activeAlarms.filter((a) => a.priority === 'LOW').length,
    unacked: activeAlarms.filter((a) => !a.isAcknowledged).length,
  };

  // ═══════════════════════════════════════════════════════════
  // Loading state
  // ═══════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: C.brand }} />
          <p style={{ color: C.muted }}>Loading alarms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* ✅ UI FIX: Removed the icon container, kept cleanly left-aligned text */}
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}
            >
              Alarm Management
            </h1>
            <p className="text-sm" style={{ color: C.muted }}>
              Monitor & manage system alarms
              <span className="ml-2 text-xs" style={{ color: C.brand, fontWeight: 600 }}>
                · 🌐 Notifications active on all pages
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg transition-all"
              style={{ background: C.cardSubtle, color: C.text, border: `1px solid ${C.border}` }}
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* ✅ Global sound toggle (persists across pages) */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                showToast(
                  !soundEnabled
                    ? `🔊 Alarm sound ENABLED globally`
                    : '🔇 Alarm sound DISABLED globally',
                  'info',
                  2500
                );
              }}
              className="p-2 rounded-lg transition-all"
              style={{
                background: soundEnabled ? C.cardHover : C.cardSubtle,
                color: soundEnabled ? C.brand : C.muted,
                border: `1px solid ${soundEnabled ? C.brand : C.border}`,
              }}
              title={
                soundEnabled
                  ? `Alarm sound ON globally — plays on ALL pages`
                  : 'Alarm sound OFF globally — click to enable'
              }
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Test button */}
            {soundEnabled && (
              <button
                onClick={() => testSound('MEDIUM')}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{ background: C.cardSubtle, color: C.text, border: `1px solid ${C.border}` }}
                title="Test alarm sound (medium priority)"
              >
                🔊 Test
              </button>
            )}

            {/* ✅ T021: Export CSV */}
            <button
              onClick={() => handleExportCSV(activeTab === 'history' ? 'history' : activeTab === 'active' ? 'active' : 'all')}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: C.success,
                color: '#FFFFFF',
                boxShadow: '0px 2px 8px rgba(22, 163, 74, 0.30)',
                fontFamily: "'Montserrat', sans-serif",
              }}
              title="Export current view as CSV"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
            </button>

            {/* Add button (only in Config tab) */}
            {activeTab === 'config' && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: C.btnPrimary,
                  boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.30)',
                  fontFamily: "'Montserrat', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.btnHover; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = C.btnPrimary; }}
                title="Add new alarm"
              >
                <Plus className="w-4 h-4 text-white" />
                Add Alarm
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ ERROR BANNER ═══════════ */}
      {error && (
        <div
          className="p-3 rounded-lg text-sm flex items-center gap-2"
          style={{ background: '#FEE2E2', border: `1px solid ${C.danger}`, color: '#B91C1C' }}
        >
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* ═══════════ STATS BOXES (T020: click to filter) ═══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatBox
          label="All Active"
          value={stats.total}
          icon={BellRing}
          color={C.brand}
          isActive={priorityFilter === null}
          onClick={() => setPriorityFilter(null)}
        />
        <StatBox
          label="Critical"
          value={stats.critical}
          icon={ShieldAlert}
          color={PRIORITY_STYLES.CRITICAL.dot}
          isActive={priorityFilter === 'CRITICAL'}
          onClick={() => setPriorityFilter(priorityFilter === 'CRITICAL' ? null : 'CRITICAL')}
        />
        <StatBox
          label="High"
          value={stats.high}
          icon={AlertTriangle}
          color={PRIORITY_STYLES.HIGH.dot}
          isActive={priorityFilter === 'HIGH'}
          onClick={() => setPriorityFilter(priorityFilter === 'HIGH' ? null : 'HIGH')}
        />
        <StatBox
          label="Medium"
          value={stats.medium}
          icon={Bell}
          color={PRIORITY_STYLES.MEDIUM.dot}
          isActive={priorityFilter === 'MEDIUM'}
          onClick={() => setPriorityFilter(priorityFilter === 'MEDIUM' ? null : 'MEDIUM')}
        />
        <StatBox
          label="Low"
          value={stats.low}
          icon={Bell}
          color={PRIORITY_STYLES.LOW.dot}
          isActive={priorityFilter === 'LOW'}
          onClick={() => setPriorityFilter(priorityFilter === 'LOW' ? null : 'LOW')}
        />
      </div>

      {/* ═══════════ FILTER INDICATOR ═══════════ */}
      {priorityFilter && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
          style={{ background: C.cardHover, border: `1px solid ${C.brand}` }}
        >
          <Filter className="w-4 h-4" style={{ color: C.brand }} />
          <span style={{ color: C.text }}>
            Filtering by:{' '}
            <strong style={{ color: getPriorityStyle(priorityFilter).dot }}>
              {priorityFilter}
            </strong>{' '}
            priority
          </span>
          <button
            onClick={() => setPriorityFilter(null)}
            className="ml-auto p-1 rounded transition-colors"
            style={{ color: C.muted }}
            title="Clear filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════════ TABS ═══════════ */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
      >
        <TabButton
          active={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          icon={BellRing}
          label={`Active (${filteredActiveAlarms.length})`}
        />
        <TabButton
          active={activeTab === 'config'}
          onClick={() => setActiveTab('config')}
          icon={Bell}
          label={`Configuration (${filteredAllAlarms.length})`}
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          icon={History}
          label={`History (${filteredHistory.length})`}
        />
      </div>

      {/* ═══════════ ACTIVE ALARMS TAB ═══════════ */}
      {activeTab === 'active' && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
        >
          {filteredActiveAlarms.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: C.success }} />
              <h3 className="text-xl font-bold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
                {priorityFilter ? `No ${priorityFilter} Alarms` : 'All Systems Normal'}
              </h3>
              <p style={{ color: C.muted }}>
                {priorityFilter ? 'No alarms match this priority filter' : 'No active alarms at this time'}
              </p>
            </div>
          ) : (
            <>
              {stats.unacked > 0 && (
                <div className="p-3" style={{ background: '#FFEDD5', borderBottom: `1px solid ${C.warning}` }}>
                  <button
                    onClick={() => setShowAckAllConfirm(true)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                    style={{
                      background: C.warning,
                      boxShadow: '0px 2px 6px rgba(245, 158, 11, 0.30)',
                      fontFamily: "'Montserrat', sans-serif",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#D97706'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = C.warning; }}
                  >
                    Acknowledge All ({stats.unacked})
                  </button>
                </div>
              )}
              <div style={{ borderTop: filteredActiveAlarms.length > 0 ? `1px solid ${C.border}` : 'none' }}>
                {filteredActiveAlarms.map((alarm, idx) => {
                  const style = getPriorityStyle(alarm.priority);
                  return (
                    <div
                      key={alarm._id}
                      className="p-4 transition-colors"
                      style={{
                        borderBottom: idx < filteredActiveAlarms.length - 1 ? `1px solid ${C.border}` : 'none',
                        background: !alarm.isAcknowledged ? style.bg : C.card,
                        borderLeft: `4px solid ${style.dot}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`w-3 h-3 ${style.dot} rounded-full mt-2 ${!alarm.isAcknowledged ? 'animate-pulse' : ''}`}
                            style={{ background: style.dot }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className="px-2 py-0.5 text-xs font-bold rounded"
                                style={{
                                  background: style.bg,
                                  color: style.text,
                                  border: `1px solid ${style.border}`,
                                }}
                              >
                                {style.icon} {alarm.priority}
                              </span>
                              <h3 className="font-bold" style={{ color: C.heading }}>
                                {alarm.alarmName}
                              </h3>
                              {alarm.isAcknowledged && (
                                <span
                                  className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
                                  style={{ background: '#DCFCE7', color: '#15803D' }}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Ack
                                </span>
                              )}
                              {alarm.enableEmail && (
                                <span
                                  className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
                                  style={{ background: C.cardHover, color: C.brand }}
                                  title={`Email sent to ${alarm.emailRecipients?.length || 0} recipient(s)`}
                                >
                                  <Mail className="w-3 h-3" />
                                  Email
                                </span>
                              )}
                            </div>
                            <p className="text-sm" style={{ color: C.text }}>{alarm.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap" style={{ color: C.muted }}>
                              <span className="font-mono">{alarm.tag}</span>
                              <span>•</span>
                              <span>{alarm.alarmType} {alarm.setpoint}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {alarm.triggeredAt ? new Date(alarm.triggeredAt).toLocaleTimeString() : '—'}
                              </span>
                              {alarm.acknowledgedBy && (
                                <>
                                  <span>•</span>
                                  <span>Ack by {alarm.acknowledgedBy}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {!alarm.isAcknowledged && (
                          <button
                            onClick={() => handleAcknowledge(alarm._id)}
                            className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-colors whitespace-nowrap"
                            style={{ background: C.success }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#15803D'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = C.success; }}
                            title="Acknowledge this alarm"
                          >
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ CONFIGURATION TAB ═══════════ */}
      {activeTab === 'config' && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
        >
          {filteredAllAlarms.length === 0 ? (
            <div className="text-center py-20">
              <Bell className="w-16 h-16 mx-auto mb-4" style={{ color: C.subtle }} />
              <h3 className="text-lg font-semibold mb-2" style={{ color: C.heading }}>
                No Alarms {priorityFilter ? `(${priorityFilter} filter)` : 'Configured'}
              </h3>
              <p style={{ color: C.muted }} className="mb-4">
                {priorityFilter ? 'Clear filter to see all alarms' : 'Create your first alarm to start monitoring'}
              </p>
              {!priorityFilter && (
                <button
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold"
                  style={{ background: C.btnPrimary, fontFamily: "'Montserrat', sans-serif" }}
                >
                  <Plus className="w-4 h-4" />
                  Add Alarm
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Tag</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Setpoint</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Priority</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Notify</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllAlarms.map((alarm, idx) => {
                    const style = getPriorityStyle(alarm.priority);
                    return (
                      <tr
                        key={alarm._id}
                        style={{
                          borderBottom: idx < filteredAllAlarms.length - 1 ? `1px solid ${C.border}` : 'none',
                          background: C.card,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = C.cardSubtle; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = C.card; }}
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`w-3 h-3 rounded-full ${alarm.isActive ? 'animate-pulse' : ''}`}
                            style={{ background: alarm.isActive ? C.danger : C.success }}
                          />
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: C.heading }}>{alarm.alarmName}</td>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: C.text }}>{alarm.tag}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs rounded font-mono" style={{ background: C.cardHover, color: C.brand }}>
                            {alarm.alarmType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: C.text }}>{alarm.setpoint}</td>
                        <td className="px-4 py-3">
                          <span
                            className="px-2 py-0.5 text-xs font-bold rounded"
                            style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
                          >
                            {alarm.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {alarm.soundEnabled !== false && (
                              <Volume2 className="w-3.5 h-3.5" style={{ color: C.brand }} title="Sound enabled" />
                            )}
                            {alarm.enableEmail && (
                              <Mail className="w-3.5 h-3.5" style={{ color: C.brand }} title={`Email → ${alarm.emailRecipients?.length || 0} recipient(s)`} />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(alarm)}
                              className="p-1.5 rounded transition-colors"
                              style={{ background: C.cardHover, color: C.brand }}
                              title="Edit alarm"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteId(alarm._id)}
                              className="p-1.5 rounded transition-colors"
                              style={{ background: '#FEE2E2', color: C.danger }}
                              title="Delete alarm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ HISTORY TAB ═══════════ */}
      {activeTab === 'history' && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
        >
          {filteredHistory.length === 0 ? (
            <div className="text-center py-20">
              <History className="w-16 h-16 mx-auto mb-4" style={{ color: C.subtle }} />
              <p style={{ color: C.muted }}>No alarm history yet</p>
              <p className="text-xs mt-1" style={{ color: C.subtle }}>History appears as alarms trigger and clear</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredHistory.map((entry, idx) => {
                const style = getPriorityStyle(entry.priority);
                return (
                  <div
                    key={entry._id}
                    className="p-3 transition-colors"
                    style={{
                      borderBottom: idx < filteredHistory.length - 1 ? `1px solid ${C.border}` : 'none',
                      borderLeft: `3px solid ${style.dot}`,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.cardSubtle; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className="px-2 py-0.5 text-xs font-bold rounded"
                          style={{ background: style.bg, color: style.text }}
                        >
                          {entry.priority}
                        </span>
                        <span className="font-medium" style={{ color: C.heading }}>{entry.alarmName}</span>
                        <span className="text-sm" style={{ color: C.text }}>{entry.message}</span>
                      </div>
                      <div className="text-xs" style={{ color: C.subtle }}>
                        {entry.triggeredAt ? new Date(entry.triggeredAt).toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ ADD/EDIT MODAL ═══════════ */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingAlarm ? 'Edit Alarm' : 'Add New Alarm'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Alarm Name *" name="alarmName" value={formData.alarmName} onChange={handleChange} required />
            <Field label="Group" name="group" value={formData.group} onChange={handleChange} />
          </div>

          <Field label="Description" name="description" value={formData.description} onChange={handleChange} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Tag *</label>
              <select
                name="tag" value={formData.tag} onChange={handleChange} required
                className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              >
                <option value="">Select tag</option>
                {tags.map((t) => (
                  <option key={t._id} value={t.tagName}>{t.tagName} ({t.dataType})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Alarm Type *</label>
              <select
                name="alarmType" value={formData.alarmType} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              >
                <option value="HIGH">HIGH (greater than)</option>
                <option value="HIGH_HIGH">HIGH HIGH (critical high)</option>
                <option value="LOW">LOW (less than)</option>
                <option value="LOW_LOW">LOW LOW (critical low)</option>
                <option value="EQUAL">EQUAL TO</option>
                <option value="NOT_EQUAL">NOT EQUAL TO</option>
                <option value="DIGITAL">DIGITAL (BOOL = TRUE)</option>
                <option value="DEVIATION">DEVIATION (outside range)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Setpoint" name="setpoint" type="number" value={formData.setpoint} onChange={handleChange} />
            <Field label="Deadband" name="deadband" type="number" value={formData.deadband} onChange={handleChange} />

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>Priority</label>
              <select
                name="priority" value={formData.priority} onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                onFocus={(e) => e.target.style.borderColor = C.brand}
                onBlur={(e) => e.target.style.borderColor = C.border}
              >
                <option value="LOW">🔵 LOW</option>
                <option value="MEDIUM">🟡 MEDIUM</option>
                <option value="HIGH">🟠 HIGH</option>
                <option value="CRITICAL">🔴 CRITICAL</option>
              </select>
            </div>
          </div>

          <Field label="Alarm Message" name="message" value={formData.message} onChange={handleChange} />

          <div
            className="p-3 rounded-lg space-y-2"
            style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="soundEnabled"
                checked={formData.soundEnabled}
                onChange={handleChange}
                style={{ accentColor: C.brand, width: '16px', height: '16px' }}
              />
              <Volume2 className="w-4 h-4" style={{ color: C.brand }} />
              <span className="text-sm font-semibold" style={{ color: C.heading }}>
                Play sound when this alarm triggers
              </span>
            </label>
          </div>

          <div
            className="p-3 rounded-lg space-y-3"
            style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="enableEmail"
                checked={formData.enableEmail}
                onChange={handleChange}
                style={{ accentColor: C.brand, width: '16px', height: '16px' }}
              />
              <Mail className="w-4 h-4" style={{ color: C.brand }} />
              <span className="text-sm font-semibold" style={{ color: C.heading }}>
                Send email notification on trigger
              </span>
            </label>

            {formData.enableEmail && (
              <div className="space-y-3 pl-6">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: C.muted }}>
                    Recipients (press Enter to add)
                  </label>
                  <input
                    type="email"
                    placeholder="engineer@company.com"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmailRecipient(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg outline-none transition-colors text-sm"
                    style={{ background: C.card, border: `1px solid ${C.border}`, color: C.heading }}
                    onFocus={(e) => e.target.style.borderColor = C.brand}
                    onBlur={(e) => e.target.style.borderColor = C.border}
                  />
                  {formData.emailRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.emailRecipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                          style={{ background: C.cardHover, color: C.brand, border: `1px solid ${C.brand}40` }}
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => removeEmailRecipient(email)}
                            style={{ color: C.brand }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Field
                  label="Throttle (minutes between repeat emails)"
                  name="emailThrottleMinutes"
                  type="number"
                  value={formData.emailThrottleMinutes}
                  onChange={handleChange}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold transition-colors"
              style={{
                background: '#FFFFFF',
                color: C.heading,
                border: `1.5px solid ${C.border}`,
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-white transition-colors"
              style={{
                background: C.btnPrimary,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.btnHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.btnPrimary}
            >
              {editingAlarm ? 'Update' : 'Create'} Alarm
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Alarm?"
        message="This will permanently delete this alarm configuration. This action cannot be undone."
        confirmText="Delete"
        confirmColor="red"
        icon="warning"
      />

      <ConfirmDialog
        isOpen={showAckAllConfirm}
        onClose={() => setShowAckAllConfirm(false)}
        onConfirm={handleAcknowledgeAll}
        title="Acknowledge All Alarms?"
        message={`This will acknowledge all ${stats.unacked} unacknowledged alarm(s). Continue?`}
        confirmText="Acknowledge All"
        confirmColor="green"
        icon="question"
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const StatBox = ({ label, value, icon: Icon, color, isActive, onClick }) => (
  <button
    onClick={onClick}
    className="p-3 rounded-xl text-left transition-all"
    style={{
      background: isActive ? `${color}15` : C.card,
      border: `1px solid ${isActive ? color : C.border}`,
      cursor: 'pointer',
      boxShadow: isActive ? `0px 4px 12px ${color}30` : '0px 4px 20px rgba(8, 27, 67, 0.04)',
    }}
    onMouseEnter={(e) => {
      if (!isActive) e.currentTarget.style.borderColor = `${color}80`;
    }}
    onMouseLeave={(e) => {
      if (!isActive) e.currentTarget.style.borderColor = C.border;
    }}
    title={isActive ? 'Click to clear filter' : `Click to filter by ${label}`}
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-xs font-semibold" style={{ color: C.muted }}>{label}</span>
    </div>
    <p className="text-2xl font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>
      {value}
    </p>
  </button>
);

const TabButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
    style={{
      background: active ? C.brand : 'transparent',
      color: active ? '#FFFFFF' : C.muted,
      fontFamily: "'Inter', sans-serif",
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.color = C.heading;
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.color = C.muted;
    }}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const Field = ({ label, name, type = 'text', value, onChange, required }) => (
  <div>
    <label className="block text-sm font-semibold mb-1.5" style={{ color: C.heading }}>
      {label}
    </label>
    <input
      type={type}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      required={required}
      className="w-full px-3 py-2 rounded-lg outline-none transition-colors"
      style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
      onFocus={(e) => e.target.style.borderColor = C.brand}
      onBlur={(e) => e.target.style.borderColor = C.border}
    />
  </div>
);

export default Alarms;