// ═══════════════════════════════════════════════════════════
// Report Controller — Generate & serve reports data
//
// Task Bundle applied:
//   ✅ T055  — Production report (tag aggregation)
//   ✅ T056  — Alarm summary report
//   ✅ T058  — Custom date range support
//   ✅ T059  — User activity report
// ═══════════════════════════════════════════════════════════

const Alarm = require('../models/Alarm');
const AlarmHistory = require('../models/AlarmHistory');
const Tag = require('../models/Tag');
const UserActivityLog = require('../models/UserActivityLog');
const { queryMultipleTagsHistory, getTagStatistics, isInfluxAvailable } = require('../services/influxService');

// ─── Helper: Parse date safely, fallback to defaults ─────────
const parseDate = (str, fallback) => {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
};

// ─── Helper: Get date range from preset or custom ────────────
const resolveDateRange = (preset, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (preset) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case 'yesterday':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
      break;
    case 'last7days':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    case 'last30days':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = now;
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case 'custom':
    default:
      start = parseDate(startDate, new Date(now.getTime() - 24 * 60 * 60 * 1000));
      end = parseDate(endDate, now);
      break;
  }

  return { start, end };
};

// ═══════════════════════════════════════════════════════════
// ✅ T055: PRODUCTION REPORT
// POST /api/reports/production
// Body: { tagIds: [], preset: 'today'|'yesterday'|..., startDate, endDate, aggregation }
// ═══════════════════════════════════════════════════════════
const getProductionReport = async (req, res) => {
  try {
    const {
      tagIds = [],
      preset = 'today',
      startDate,
      endDate,
      aggregation = '1h',
    } = req.body;

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one tag',
      });
    }

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    // ─── Fetch tag metadata ───
    const tags = await Tag.find({ _id: { $in: tagIds } }).select('_id tagName unit dataType description');
    const tagMap = new Map(tags.map(t => [t._id.toString(), t]));

    // ─── Fetch time-series data from InfluxDB ───
    let timeSeries = [];
    let statistics = [];

    if (isInfluxAvailable()) {
      try {
        // Convert custom range to InfluxDB-friendly format
        const startISO = start.toISOString();
        const endISO = end.toISOString();

        // Fetch history using custom range query
        const { queryCustomTimeRange } = require('../services/influxService');
        const rawData = await queryCustomTimeRange(tagIds, startISO, endISO, aggregation);

        // Group by tagId
        const grouped = {};
        rawData.forEach((point) => {
          if (!grouped[point.tagId]) {
            grouped[point.tagId] = {
              tagId: point.tagId,
              tagName: point.tagName || tagMap.get(point.tagId)?.tagName,
              unit: point.unit || tagMap.get(point.tagId)?.unit || '',
              data: [],
            };
          }
          grouped[point.tagId].data.push({ time: point.time, value: point.value });
        });
        timeSeries = Object.values(grouped);

        // Compute statistics using timeRange helpers or manually from timeSeries
        for (const tagId of tagIds) {
          const series = grouped[tagId]?.data || [];
          if (series.length > 0) {
            const values = series.map(p => p.value).filter(v => typeof v === 'number' && !isNaN(v));
            if (values.length > 0) {
              const min = Math.min(...values);
              const max = Math.max(...values);
              const sum = values.reduce((a, b) => a + b, 0);
              const mean = sum / values.length;
              const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
              const stddev = Math.sqrt(variance);
              const first = series[0].value;
              const last = series[series.length - 1].value;
              const delta = last - first;

              statistics.push({
                tagId,
                tagName: tagMap.get(tagId)?.tagName || 'Unknown',
                unit: tagMap.get(tagId)?.unit || '',
                count: values.length,
                min: parseFloat(min.toFixed(3)),
                max: parseFloat(max.toFixed(3)),
                mean: parseFloat(mean.toFixed(3)),
                stddev: parseFloat(stddev.toFixed(3)),
                range: parseFloat((max - min).toFixed(3)),
                first: parseFloat(first?.toFixed?.(3) || first),
                last: parseFloat(last?.toFixed?.(3) || last),
                delta: parseFloat(delta.toFixed(3)),
              });
            }
          } else {
            const tag = tagMap.get(tagId);
            statistics.push({
              tagId,
              tagName: tag?.tagName || 'Unknown',
              unit: tag?.unit || '',
              count: 0,
              min: 0, max: 0, mean: 0, stddev: 0, range: 0,
              first: null, last: null, delta: 0,
              noData: true,
            });
          }
        }
      } catch (err) {
        console.warn('InfluxDB query failed for production report:', err.message);
      }
    } else {
      // InfluxDB not available — return current values only
      tags.forEach(tag => {
        statistics.push({
          tagId: tag._id.toString(),
          tagName: tag.tagName,
          unit: tag.unit || '',
          count: 0,
          min: 0, max: 0, mean: 0, stddev: 0, range: 0,
          first: null, last: null, delta: 0,
          noData: true,
          reason: 'InfluxDB not configured — historical data unavailable',
        });
      });
    }

    res.json({
      success: true,
      report: {
        type: 'production',
        title: 'Production Report',
        generatedAt: new Date(),
        dateRange: { start, end, preset },
        aggregation,
        tags: tags.map(t => ({
          _id: t._id,
          tagName: t.tagName,
          unit: t.unit,
          description: t.description,
        })),
        statistics,
        timeSeries,
        influxAvailable: isInfluxAvailable(),
      },
    });
  } catch (error) {
    console.error('Production Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate production report',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ T056: ALARM SUMMARY REPORT
// POST /api/reports/alarms
// Body: { preset, startDate, endDate, priority }
// ═══════════════════════════════════════════════════════════
const getAlarmReport = async (req, res) => {
  try {
    const {
      preset = 'last7days',
      startDate,
      endDate,
      priority = null,
    } = req.body;

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    // ─── Build filter ───
    const filter = {
      timestamp: { $gte: start, $lte: end },
    };
    if (priority) filter.priority = priority.toUpperCase();

    // ─── Fetch alarm history ───
    const history = await AlarmHistory.find(filter)
      .sort({ timestamp: -1 })
      .limit(5000); // Cap at 5000 for performance

    // ─── Compute summary stats ───
    const triggeredEvents = history.filter(h => h.event === 'TRIGGERED');
    const clearedEvents = history.filter(h => h.event === 'CLEARED');
    const ackedEvents = history.filter(h => h.event === 'ACKNOWLEDGED');

    const byPriority = {
      CRITICAL: triggeredEvents.filter(h => h.priority === 'CRITICAL').length,
      HIGH: triggeredEvents.filter(h => h.priority === 'HIGH').length,
      MEDIUM: triggeredEvents.filter(h => h.priority === 'MEDIUM').length,
      LOW: triggeredEvents.filter(h => h.priority === 'LOW').length,
    };

    // ─── Top 10 most frequent alarms ───
    const alarmCounts = {};
    triggeredEvents.forEach(h => {
      alarmCounts[h.alarmName] = (alarmCounts[h.alarmName] || 0) + 1;
    });
    const topAlarms = Object.entries(alarmCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // ─── Timeline (hourly buckets) ───
    const hoursDiff = Math.ceil((end - start) / (60 * 60 * 1000));
    const bucketSize = hoursDiff <= 24 ? 60 * 60 * 1000 :        // 1h buckets if <= 24h
                       hoursDiff <= 168 ? 6 * 60 * 60 * 1000 :    // 6h buckets if <= 7d
                       24 * 60 * 60 * 1000;                        // daily buckets otherwise

    const buckets = new Map();
    triggeredEvents.forEach(h => {
      const bucketTime = Math.floor(new Date(h.timestamp).getTime() / bucketSize) * bucketSize;
      const key = new Date(bucketTime).toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, { time: key, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 });
      }
      const bucket = buckets.get(key);
      bucket[h.priority] = (bucket[h.priority] || 0) + 1;
      bucket.total += 1;
    });
    const timeline = Array.from(buckets.values()).sort((a, b) => new Date(a.time) - new Date(b.time));

    // ─── Currently active alarms ───
    const activeAlarms = await Alarm.find({ isActive: true }).sort({ triggeredAt: -1 });

    res.json({
      success: true,
      report: {
        type: 'alarms',
        title: 'Alarm Summary Report',
        generatedAt: new Date(),
        dateRange: { start, end, preset },
        summary: {
          totalTriggered: triggeredEvents.length,
          totalCleared: clearedEvents.length,
          totalAcknowledged: ackedEvents.length,
          currentlyActive: activeAlarms.length,
          currentlyUnacked: activeAlarms.filter(a => !a.isAcknowledged).length,
          byPriority,
        },
        topAlarms,
        timeline,
        history: history.slice(0, 500), // Return top 500 for table display
        activeAlarms,
        historyTotalCount: history.length,
      },
    });
  } catch (error) {
    console.error('Alarm Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate alarm report',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ T059: USER ACTIVITY REPORT
// POST /api/reports/activity
// Body: { preset, startDate, endDate, username, action }
// ═══════════════════════════════════════════════════════════
const getActivityReport = async (req, res) => {
  try {
    const {
      preset = 'today',
      startDate,
      endDate,
      username = null,
      action = null,
    } = req.body;

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    // ─── Build filter ───
    const filter = {
      createdAt: { $gte: start, $lte: end },
    };
    if (username) filter.username = username;
    if (action) filter.action = action;

    // ─── Fetch activity logs ───
    const logs = await UserActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000);

    // ─── Compute summary stats ───
    const byAction = {};
    const byUser = {};
    const successCount = { success: 0, failed: 0 };

    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byUser[log.username] = (byUser[log.username] || 0) + 1;
      if (log.success) successCount.success += 1;
      else successCount.failed += 1;
    });

    // Top users
    const topUsers = Object.entries(byUser)
      .map(([name, count]) => ({ username: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top actions
    const topActions = Object.entries(byAction)
      .map(([name, count]) => ({ action: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Login events only
    const loginEvents = logs.filter(l => ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'].includes(l.action));

    res.json({
      success: true,
      report: {
        type: 'activity',
        title: 'User Activity Report',
        generatedAt: new Date(),
        dateRange: { start, end, preset },
        summary: {
          totalEvents: logs.length,
          uniqueUsers: Object.keys(byUser).length,
          successCount: successCount.success,
          failedCount: successCount.failed,
          loginCount: logs.filter(l => l.action === 'LOGIN').length,
          failedLoginCount: logs.filter(l => l.action === 'LOGIN_FAILED').length,
        },
        topUsers,
        topActions,
        loginEvents: loginEvents.slice(0, 200),
        logs: logs.slice(0, 500), // Top 500 for table
        totalCount: logs.length,
      },
    });
  } catch (error) {
    console.error('Activity Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate activity report',
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// LOG activity helper (called by other controllers)
// Internal use only — export for reuse
// ═══════════════════════════════════════════════════════════
const logActivity = async (data) => {
  try {
    await UserActivityLog.create({
      username: data.username || 'unknown',
      userRole: data.userRole || 'unknown',
      userId: data.userId || null,
      action: data.action,
      target: data.target || '',
      description: data.description || '',
      metadata: data.metadata || {},
      ipAddress: data.ipAddress || '',
      userAgent: data.userAgent || '',
      success: data.success !== false,
      errorMessage: data.errorMessage || '',
    });
  } catch (err) {
    console.warn('Failed to log activity:', err.message);
    // Silent — don't break the main flow if logging fails
  }
};

// ═══════════════════════════════════════════════════════════
// GET RECENT ACTIVITY (used elsewhere too)
// GET /api/reports/activity/recent?limit=50
// ═══════════════════════════════════════════════════════════
const getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await UserActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProductionReport,
  getAlarmReport,
  getActivityReport,
  logActivity,
  getRecentActivity,
};