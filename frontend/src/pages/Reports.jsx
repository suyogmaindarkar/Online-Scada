// ═══════════════════════════════════════════════════════════
// Reports Page — Blue theme + PDF/CSV export
//
// Task Bundle applied:
//   ✅ T055  — Production report
//   ✅ T056  — Alarm summary report
//   ✅ T057  — PDF export (using jspdf)
//   ✅ T058  — Custom date range selector
//   ✅ T059  — User activity report
// ═══════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Printer, Calendar, TrendingUp,
  Bell, Users, Loader2, RefreshCw, Filter, BarChart3,
  CheckCircle, XCircle, AlertTriangle, User, Clock,
  Activity, ArrowUp, ArrowDown, Minus, Table as TableIcon,
} from 'lucide-react';
import { tagAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  purple:     '#9333EA',
};

const PRIORITY_COLORS = {
  CRITICAL: '#DC2626',
  HIGH:     '#EA580C',
  MEDIUM:   '#F59E0B',
  LOW:      '#2563EB',
};

const DATE_PRESETS = [
  { value: 'today',      label: 'Today' },
  { value: 'yesterday',  label: 'Yesterday' },
  { value: 'last7days',  label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'thisMonth',  label: 'This Month' },
  { value: 'lastMonth',  label: 'Last Month' },
  { value: 'custom',     label: 'Custom Range' },
];

const Reports = () => {
  const { showToast } = useToast();

  const [activeReport, setActiveReport] = useState('production'); // 'production' | 'alarms' | 'activity'
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Common filters
  const [preset, setPreset] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Production report filters
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [aggregation, setAggregation] = useState('1h');

  // Alarm report filters
  const [priorityFilter, setPriorityFilter] = useState('');

  // Activity report filters
  const [usernameFilter, setUsernameFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // ─── Load tags for production report ───
  useEffect(() => {
    const loadTags = async () => {
      try {
        const res = await tagAPI.getAll();
        const tags = res.data?.data || [];
        setAvailableTags(tags);
      } catch (err) {
        console.error('Failed to load tags', err);
      }
    };
    loadTags();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // Generate report
  // ═══════════════════════════════════════════════════════════
  const generateReport = async () => {
    try {
      setLoading(true);
      setReportData(null);

      const body = {
        preset,
        startDate: preset === 'custom' ? customStart : undefined,
        endDate: preset === 'custom' ? customEnd : undefined,
      };

      let res;
      if (activeReport === 'production') {
        if (selectedTagIds.length === 0) {
          showToast('Please select at least one tag', 'warning');
          setLoading(false);
          return;
        }
        body.tagIds = selectedTagIds;
        body.aggregation = aggregation;
        res = await api.post('/reports/production', body);
      } else if (activeReport === 'alarms') {
        if (priorityFilter) body.priority = priorityFilter;
        res = await api.post('/reports/alarms', body);
      } else if (activeReport === 'activity') {
        if (usernameFilter) body.username = usernameFilter;
        if (actionFilter) body.action = actionFilter;
        res = await api.post('/reports/activity', body);
      }

      setReportData(res.data.report);
      showToast('Report generated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to generate report', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ T057: Export to PDF
  // ═══════════════════════════════════════════════════════════
  const exportPDF = () => {
    if (!reportData) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // ─── HEADER ───
      // Brand blue background bar
      doc.setFillColor(8, 27, 67);
      doc.rect(0, 0, pageWidth, 25, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('OnlineSCADA', 14, 12);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(reportData.title, 14, 19);

      // Right side: generated date
      doc.setFontSize(8);
      doc.text(
        `Generated: ${new Date(reportData.generatedAt).toLocaleString()}`,
        pageWidth - 14,
        19,
        { align: 'right' }
      );

      // Date range under header
      let y = 32;
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Date Range:', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${new Date(reportData.dateRange.start).toLocaleString()} → ${new Date(reportData.dateRange.end).toLocaleString()}`,
        45, y
      );
      y += 10;

      // ─── REPORT-SPECIFIC CONTENT ───
      if (reportData.type === 'production') {
        exportProductionPDF(doc, reportData, y);
      } else if (reportData.type === 'alarms') {
        exportAlarmPDF(doc, reportData, y);
      } else if (reportData.type === 'activity') {
        exportActivityPDF(doc, reportData, y);
      }

      // ─── FOOTER (added to each page) ───
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(229, 231, 235);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('OnlineSCADA · Modern Web-Based SCADA', 14, pageHeight - 10);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
      }

      // Save
      const filename = `${reportData.type}_report_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      showToast('PDF exported successfully', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      showToast('Failed to export PDF', 'error');
    }
  };

  // ─── Production PDF content ───
  const exportProductionPDF = (doc, data, startY) => {
    let y = startY;

    // Statistics table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(8, 27, 67);
    doc.text('Statistics Summary', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y + 2,
      head: [['Tag', 'Unit', 'Count', 'Min', 'Max', 'Avg', 'Std Dev', 'Range', 'Delta']],
      body: data.statistics.map(s => [
        s.tagName,
        s.unit || '-',
        s.count.toLocaleString(),
        s.noData ? '—' : s.min,
        s.noData ? '—' : s.max,
        s.noData ? '—' : s.mean,
        s.noData ? '—' : s.stddev,
        s.noData ? '—' : s.range,
        s.noData ? '—' : (s.delta >= 0 ? '+' + s.delta : s.delta),
      ]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 2 },
    });
  };

  // ─── Alarm PDF content ───
  const exportAlarmPDF = (doc, data, startY) => {
    let y = startY;

    // Summary boxes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(8, 27, 67);
    doc.text('Summary', 14, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total Triggered: ${data.summary.totalTriggered}`, 14, y);
    doc.text(`Currently Active: ${data.summary.currentlyActive}`, 70, y);
    doc.text(`Unacknowledged: ${data.summary.currentlyUnacked}`, 130, y);
    y += 8;

    // Priority breakdown
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('By Priority:', 14, y);
    y += 3;

    autoTable(doc, {
      startY: y + 2,
      head: [['Priority', 'Count']],
      body: [
        ['🔴 CRITICAL', data.summary.byPriority.CRITICAL || 0],
        ['🟠 HIGH', data.summary.byPriority.HIGH || 0],
        ['🟡 MEDIUM', data.summary.byPriority.MEDIUM || 0],
        ['🔵 LOW', data.summary.byPriority.LOW || 0],
      ],
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      styles: { cellPadding: 2 },
      tableWidth: 80,
    });

    y = doc.lastAutoTable.finalY + 8;

    // Top alarms
    if (data.topAlarms && data.topAlarms.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Top 10 Most Frequent Alarms:', 14, y);
      y += 3;

      autoTable(doc, {
        startY: y + 2,
        head: [['#', 'Alarm Name', 'Trigger Count']],
        body: data.topAlarms.map((a, i) => [i + 1, a.name, a.count]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // Recent history (last 50)
    if (data.history && data.history.length > 0) {
      // Force new page if too close to bottom
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Recent Events (showing ${Math.min(50, data.history.length)} of ${data.historyTotalCount}):`, 14, y);
      y += 3;

      autoTable(doc, {
        startY: y + 2,
        head: [['Time', 'Alarm', 'Priority', 'Event', 'Message']],
        body: data.history.slice(0, 50).map(h => [
          new Date(h.timestamp).toLocaleString(),
          h.alarmName,
          h.priority,
          h.event,
          (h.message || '').substring(0, 40),
        ]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        styles: { cellPadding: 1.5 },
      });
    }
  };

  // ─── Activity PDF content ───
  const exportActivityPDF = (doc, data, startY) => {
    let y = startY;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(8, 27, 67);
    doc.text('Summary', 14, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Total Events: ${data.summary.totalEvents}`, 14, y);
    doc.text(`Unique Users: ${data.summary.uniqueUsers}`, 70, y);
    doc.text(`Failed Logins: ${data.summary.failedLoginCount}`, 130, y);
    y += 8;

    // Top users
    if (data.topUsers && data.topUsers.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Most Active Users:', 14, y);
      y += 3;

      autoTable(doc, {
        startY: y + 2,
        head: [['User', 'Actions']],
        body: data.topUsers.map(u => [u.username, u.count]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        styles: { cellPadding: 2 },
        tableWidth: 100,
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // Activity log
    if (data.logs && data.logs.length > 0) {
      if (y > 220) {
        doc.addPage();
        y = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Activity Log (showing ${Math.min(100, data.logs.length)} of ${data.totalCount}):`, 14, y);
      y += 3;

      autoTable(doc, {
        startY: y + 2,
        head: [['Time', 'User', 'Action', 'Target', 'Status']],
        body: data.logs.slice(0, 100).map(l => [
          new Date(l.createdAt).toLocaleString(),
          l.username,
          l.action,
          (l.target || '').substring(0, 30),
          l.success ? 'OK' : 'FAIL',
        ]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 7 },
        styles: { cellPadding: 1.5 },
      });
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Export to CSV (bonus)
  // ═══════════════════════════════════════════════════════════
  const exportCSV = () => {
    if (!reportData) return;

    try {
      const escape = (v) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      };

      let csv = `# OnlineSCADA ${reportData.title}\n`;
      csv += `# Generated: ${new Date(reportData.generatedAt).toISOString()}\n`;
      csv += `# Date Range: ${new Date(reportData.dateRange.start).toISOString()} to ${new Date(reportData.dateRange.end).toISOString()}\n\n`;

      if (reportData.type === 'production') {
        csv += 'Tag,Unit,Count,Min,Max,Avg,StdDev,Range,First,Last,Delta\n';
        reportData.statistics.forEach(s => {
          csv += [
            escape(s.tagName),
            escape(s.unit),
            s.count,
            s.noData ? '' : s.min,
            s.noData ? '' : s.max,
            s.noData ? '' : s.mean,
            s.noData ? '' : s.stddev,
            s.noData ? '' : s.range,
            s.noData ? '' : (s.first ?? ''),
            s.noData ? '' : (s.last ?? ''),
            s.noData ? '' : s.delta,
          ].join(',') + '\n';
        });
      } else if (reportData.type === 'alarms') {
        csv += 'Timestamp,Alarm Name,Tag,Priority,Event,Trigger Value,Message,User\n';
        reportData.history.forEach(h => {
          csv += [
            new Date(h.timestamp).toISOString(),
            escape(h.alarmName),
            escape(h.tag),
            h.priority,
            h.event,
            h.triggerValue ?? '',
            escape(h.message),
            escape(h.user),
          ].join(',') + '\n';
        });
      } else if (reportData.type === 'activity') {
        csv += 'Timestamp,Username,Role,Action,Target,Description,IP,Success\n';
        reportData.logs.forEach(l => {
          csv += [
            new Date(l.createdAt).toISOString(),
            escape(l.username),
            escape(l.userRole),
            l.action,
            escape(l.target),
            escape(l.description),
            escape(l.ipAddress),
            l.success ? 'YES' : 'NO',
          ].join(',') + '\n';
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportData.type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('CSV exported successfully', 'success');
    } catch (err) {
      showToast('Failed to export CSV', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Print (browser print dialog)
  // ═══════════════════════════════════════════════════════════
  const handlePrint = () => window.print();

  // Toggle tag selection
  const toggleTag = (tagId) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
    } else {
      if (selectedTagIds.length >= 10) {
        showToast('Maximum 10 tags allowed', 'warning');
        return;
      }
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="space-y-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ═══════════ HEADER ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${C.brand} 0%, ${C.brandDark} 100%)`,
                boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.30)',
              }}
            >
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
                Reports
              </h1>
              <p className="text-sm mt-0.5" style={{ color: C.muted }}>
                Generate & export production, alarm, and activity reports
              </p>
            </div>
          </div>

          {reportData && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: C.cardSubtle, color: C.text, border: `1px solid ${C.border}` }}
                title="Print report using browser print dialog"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: C.success,
                  boxShadow: '0px 2px 8px rgba(22, 163, 74, 0.30)',
                  fontFamily: "'Montserrat', sans-serif",
                }}
                title="Download as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                style={{
                  background: C.danger,
                  boxShadow: '0px 2px 8px rgba(220, 38, 38, 0.30)',
                  fontFamily: "'Montserrat', sans-serif",
                }}
                title="Download as PDF"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ REPORT TYPE TABS ═══════════ */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
      >
        <ReportTab
          active={activeReport === 'production'}
          onClick={() => { setActiveReport('production'); setReportData(null); }}
          icon={TrendingUp}
          label="Production"
        />
        <ReportTab
          active={activeReport === 'alarms'}
          onClick={() => { setActiveReport('alarms'); setReportData(null); }}
          icon={Bell}
          label="Alarms"
        />
        <ReportTab
          active={activeReport === 'activity'}
          onClick={() => { setActiveReport('activity'); setReportData(null); }}
          icon={Users}
          label="User Activity"
        />
      </div>

      {/* ═══════════ FILTERS PANEL ═══════════ */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4" style={{ color: C.brand }} />
          <h3 className="text-sm font-bold uppercase" style={{ color: C.heading, letterSpacing: '0.05em' }}>
            Report Filters
          </h3>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>DATE RANGE</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full px-3 py-2 rounded-lg outline-none text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
            >
              {DATE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {preset === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>START</label>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                  style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>END</label>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                  style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
                />
              </div>
            </>
          )}
        </div>

        {/* Production filters: tag selection + aggregation */}
        {activeReport === 'production' && (
          <>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>
                SELECT TAGS ({selectedTagIds.length}/10)
              </label>
              <div
                className="p-3 rounded-lg max-h-48 overflow-y-auto"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}` }}
              >
                {availableTags.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: C.muted }}>
                    No tags available. Create a Simulation PLC to get demo tags.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                    {availableTags.map(tag => (
                      <label
                        key={tag._id}
                        className="flex items-center gap-2 p-2 rounded cursor-pointer transition-colors"
                        style={{
                          background: selectedTagIds.includes(tag._id) ? C.cardHover : 'transparent',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = C.cardHover}
                        onMouseLeave={(e) => {
                          if (!selectedTagIds.includes(tag._id)) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTagIds.includes(tag._id)}
                          onChange={() => toggleTag(tag._id)}
                          style={{ accentColor: C.brand }}
                        />
                        <span className="text-xs font-mono truncate" style={{ color: C.heading }}>
                          {tag.tagName}
                        </span>
                        {tag.unit && (
                          <span className="text-[10px]" style={{ color: C.subtle }}>({tag.unit})</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>AGGREGATION</label>
              <select
                value={aggregation}
                onChange={(e) => setAggregation(e.target.value)}
                className="w-48 px-3 py-2 rounded-lg outline-none text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="6h">6 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>
          </>
        )}

        {/* Alarm filters */}
        {activeReport === 'alarms' && (
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>PRIORITY FILTER</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-48 px-3 py-2 rounded-lg outline-none text-sm"
              style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">🔴 Critical only</option>
              <option value="HIGH">🟠 High only</option>
              <option value="MEDIUM">🟡 Medium only</option>
              <option value="LOW">🔵 Low only</option>
            </select>
          </div>
        )}

        {/* Activity filters */}
        {activeReport === 'activity' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>USERNAME</label>
              <input
                type="text"
                value={usernameFilter}
                onChange={(e) => setUsernameFilter(e.target.value)}
                placeholder="Filter by username (leave blank for all)"
                className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: C.muted }}>ACTION</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg outline-none text-sm"
                style={{ background: C.cardSubtle, border: `1px solid ${C.border}`, color: C.heading }}
              >
                <option value="">All Actions</option>
                <option value="LOGIN">Login</option>
                <option value="LOGIN_FAILED">Failed Login</option>
                <option value="LOGOUT">Logout</option>
                <option value="TAG_WRITE">Tag Write</option>
                <option value="ALARM_ACKNOWLEDGED">Alarm Ack</option>
                <option value="RECIPE_EXECUTED">Recipe Executed</option>
                <option value="PLC_STARTED">PLC Started</option>
                <option value="PLC_STOPPED">PLC Stopped</option>
              </select>
            </div>
          </div>
        )}

        {/* Generate button */}
        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: C.btnPrimary,
              boxShadow: '0px 4px 12px rgba(37, 99, 235, 0.25)',
              fontFamily: "'Montserrat', sans-serif",
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = C.btnHover; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = C.btnPrimary; }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* ═══════════ REPORT PREVIEW ═══════════ */}
      {loading && (
        <div className="p-12 rounded-2xl text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: C.brand }} />
          <p style={{ color: C.muted }}>Generating report...</p>
        </div>
      )}

      {!loading && reportData && (
        <div id="report-preview" className="space-y-4">
          {reportData.type === 'production' && <ProductionReportView data={reportData} />}
          {reportData.type === 'alarms' && <AlarmReportView data={reportData} />}
          {reportData.type === 'activity' && <ActivityReportView data={reportData} />}
        </div>
      )}

      {!loading && !reportData && (
        <div
          className="p-12 rounded-2xl text-center"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: C.cardHover }}
          >
            <FileText className="w-10 h-10" style={{ color: C.brand }} />
          </div>
          <h3 className="text-lg font-bold mb-2" style={{ color: C.heading, fontFamily: "'Montserrat', sans-serif" }}>
            Configure & Generate Report
          </h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: C.muted }}>
            Select filters above and click <strong style={{ color: C.brand }}>Generate Report</strong> to see the results.
          </p>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

const ReportTab = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors"
    style={{
      background: active ? C.brand : 'transparent',
      color: active ? '#FFFFFF' : C.muted,
      fontFamily: "'Inter', sans-serif",
    }}
    onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = C.heading; }}
    onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = C.muted; }}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

// ─── PRODUCTION REPORT VIEW ─────────────────────────────────
const ProductionReportView = ({ data }) => (
  <>
    {/* Warning if no data */}
    {!data.influxAvailable && (
      <div
        className="p-3 rounded-lg text-sm flex items-center gap-2"
        style={{ background: '#FEF3C7', border: `1px solid ${C.warning}`, color: '#78350F' }}
      >
        <AlertTriangle className="w-4 h-4" />
        InfluxDB not available — historical data cannot be shown. Configure InfluxDB in .env to enable.
      </div>
    )}

    {/* Statistics table */}
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
    >
      <div className="px-4 py-3" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: C.brand }} />
          <h3 className="text-sm font-bold" style={{ color: C.heading }}>Statistics Summary</h3>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Tag</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Unit</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Count</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Min</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Max</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Avg</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Std Dev</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Range</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Delta</th>
            </tr>
          </thead>
          <tbody>
            {data.statistics.map((s, idx) => (
              <tr
                key={s.tagId}
                style={{
                  borderBottom: idx < data.statistics.length - 1 ? `1px solid ${C.border}` : 'none',
                }}
              >
                <td className="px-3 py-2 font-mono font-semibold" style={{ color: C.heading }}>{s.tagName}</td>
                <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>{s.unit || '—'}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: C.text }}>{s.count.toLocaleString()}</td>
                {s.noData ? (
                  <td colSpan="6" className="px-3 py-2 text-center italic" style={{ color: C.subtle }}>
                    No data
                  </td>
                ) : (
                  <>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: C.brand }}>{s.min}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: C.brand }}>{s.max}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: C.heading }}>{s.mean}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: C.text }}>{s.stddev}</td>
                    <td className="px-3 py-2 text-right font-mono" style={{ color: C.text }}>{s.range}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: s.delta >= 0 ? C.success : C.danger }}>
                      {s.delta >= 0 ? '+' : ''}{s.delta}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </>
);

// ─── ALARM REPORT VIEW ──────────────────────────────────────
const AlarmReportView = ({ data }) => (
  <>
    {/* Summary boxes */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryCard label="Total Triggered" value={data.summary.totalTriggered} color={C.brand} icon={Bell} />
      <SummaryCard label="Currently Active" value={data.summary.currentlyActive} color={C.danger} icon={Activity} />
      <SummaryCard label="Unacknowledged" value={data.summary.currentlyUnacked} color={C.warning} icon={AlertTriangle} />
      <SummaryCard label="Acknowledged" value={data.summary.totalAcknowledged} color={C.success} icon={CheckCircle} />
    </div>

    {/* Priority breakdown */}
    <div
      className="p-4 rounded-2xl"
      style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
    >
      <h3 className="text-sm font-bold mb-3" style={{ color: C.heading }}>By Priority</h3>
      <div className="grid grid-cols-4 gap-3">
        {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
          <div
            key={p}
            className="p-3 rounded-lg text-center"
            style={{ background: `${PRIORITY_COLORS[p]}15`, border: `1px solid ${PRIORITY_COLORS[p]}40` }}
          >
            <p className="text-2xl font-bold" style={{ color: PRIORITY_COLORS[p], fontFamily: "'Montserrat', sans-serif" }}>
              {data.summary.byPriority[p] || 0}
            </p>
            <p className="text-xs font-bold mt-1" style={{ color: PRIORITY_COLORS[p] }}>{p}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Top 10 alarms */}
    {data.topAlarms.length > 0 && (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="px-4 py-3" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-bold" style={{ color: C.heading }}>Top 10 Most Frequent Alarms</h3>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>#</th>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Alarm Name</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Trigger Count</th>
            </tr>
          </thead>
          <tbody>
            {data.topAlarms.map((a, i) => (
              <tr key={i} style={{ borderBottom: i < data.topAlarms.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>{i + 1}</td>
                <td className="px-3 py-2 font-semibold" style={{ color: C.heading }}>{a.name}</td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: C.brand }}>{a.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Recent events */}
    {data.history.length > 0 && (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="px-4 py-3" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-bold" style={{ color: C.heading }}>
            Recent Events ({data.history.length} of {data.historyTotalCount})
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0 }}>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Time</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Alarm</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Priority</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Event</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Message</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h, i) => (
                <tr key={h._id || i} style={{ borderBottom: i < data.history.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-semibold text-xs" style={{ color: C.heading }}>{h.alarmName}</td>
                  <td className="px-3 py-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded"
                      style={{ background: `${PRIORITY_COLORS[h.priority]}20`, color: PRIORITY_COLORS[h.priority] }}
                    >
                      {h.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded"
                      style={{
                        background: h.event === 'TRIGGERED' ? '#FEE2E2' : h.event === 'CLEARED' ? '#DCFCE7' : '#DBEAFE',
                        color: h.event === 'TRIGGERED' ? C.danger : h.event === 'CLEARED' ? C.success : C.brand,
                      }}
                    >
                      {h.event}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs truncate max-w-xs" style={{ color: C.text }} title={h.message}>
                    {h.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>
);

// ─── ACTIVITY REPORT VIEW ───────────────────────────────────
const ActivityReportView = ({ data }) => (
  <>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <SummaryCard label="Total Events" value={data.summary.totalEvents} color={C.brand} icon={Activity} />
      <SummaryCard label="Unique Users" value={data.summary.uniqueUsers} color={C.purple} icon={Users} />
      <SummaryCard label="Logins" value={data.summary.loginCount} color={C.success} icon={CheckCircle} />
      <SummaryCard label="Failed Logins" value={data.summary.failedLoginCount} color={C.danger} icon={XCircle} />
    </div>

    {/* Top users */}
    {data.topUsers.length > 0 && (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="px-4 py-3" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-bold" style={{ color: C.heading }}>Most Active Users</h3>
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>User</th>
              <th className="text-right px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.topUsers.map((u, i) => (
              <tr key={i} style={{ borderBottom: i < data.topUsers.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <td className="px-3 py-2 font-semibold" style={{ color: C.heading }}>
                  <span className="inline-flex items-center gap-2">
                    <User className="w-3 h-3" style={{ color: C.brand }} />
                    {u.username}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: C.brand }}>{u.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {/* Activity log */}
    {data.logs.length > 0 && (
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.06)' }}
      >
        <div className="px-4 py-3" style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="text-sm font-bold" style={{ color: C.heading }}>
            Activity Log ({data.logs.length} of {data.totalCount})
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead style={{ background: C.cardSubtle, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0 }}>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Time</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>User</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Action</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Target</th>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase" style={{ color: C.muted }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l, i) => (
                <tr key={l._id || i} style={{ borderBottom: i < data.logs.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <td className="px-3 py-2 text-xs" style={{ color: C.muted }}>
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-semibold text-xs" style={{ color: C.heading }}>{l.username}</td>
                  <td className="px-3 py-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold rounded font-mono"
                      style={{ background: C.cardHover, color: C.brand }}
                    >
                      {l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs truncate max-w-xs" style={{ color: C.text }}>{l.target || '—'}</td>
                  <td className="px-3 py-2">
                    {l.success ? (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: C.success }}>
                        <CheckCircle className="w-3 h-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs" style={{ color: C.danger }}>
                        <XCircle className="w-3 h-3" /> FAIL
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>
);

const SummaryCard = ({ label, value, color, icon: Icon }) => (
  <div
    className="p-4 rounded-xl"
    style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0px 4px 20px rgba(8, 27, 67, 0.04)' }}
  >
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-xs font-semibold" style={{ color: C.muted }}>{label}</span>
    </div>
    <p className="text-2xl font-bold" style={{ color, fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
  </div>
);

export default Reports;