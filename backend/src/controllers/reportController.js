// ============================================================================
// Report Controller — Multi-Tenant MongoDB Historian
// Production / Alarm / Activity reports. No InfluxDB dependency.
// ============================================================================

const Alarm = require('../models/Alarm');
const AlarmHistory = require('../models/AlarmHistory');
const Tag = require('../models/Tag');
const UserActivityLog = require('../models/UserActivityLog');
const {
  queryCustomTimeRange,
} = require('../services/historianService');

const parseDate = (str, fallback) => {
  if (!str) return fallback;
  const d = new Date(str);
  return isNaN(d.getTime()) ? fallback : d;
};

const resolveDateRange = (preset, startDate, endDate) => {
  const now = new Date();
  let start;
  let end;

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

const getCompanyId = (req) => req.companyId || req.user?.companyId || req.user?.company;

const computeSeriesStats = (series, tagMeta) => {
  const values = (series || [])
    .map((p) => p.value)
    .filter((v) => typeof v === 'number' && !Number.isNaN(v));

  if (values.length === 0) {
    return {
      tagId: tagMeta._id?.toString?.() || tagMeta.tagId,
      tagName: tagMeta.tagName || 'Unknown',
      unit: tagMeta.unit || '',
      count: 0,
      min: 0,
      max: 0,
      mean: 0,
      stddev: 0,
      range: 0,
      first: null,
      last: null,
      delta: 0,
      noData: true,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const first = values[0];
  const last = values[values.length - 1];

  return {
    tagId: tagMeta._id?.toString?.() || tagMeta.tagId,
    tagName: tagMeta.tagName || 'Unknown',
    unit: tagMeta.unit || '',
    count: values.length,
    min: +min.toFixed(3),
    max: +max.toFixed(3),
    mean: +mean.toFixed(3),
    stddev: +Math.sqrt(variance).toFixed(3),
    range: +(max - min).toFixed(3),
    first: +first.toFixed(3),
    last: +last.toFixed(3),
    delta: +(last - first).toFixed(3),
    noData: false,
  };
};

// ============================================================================
// PRODUCTION REPORT
// ============================================================================
const getProductionReport = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      tagIds = [],
      preset = 'today',
      startDate,
      endDate,
      aggregation = '1h',
    } = req.body;

    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one tag' });
    }
    if (tagIds.length > 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 tags allowed per report' });
    }

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    const tags = await Tag.find({
      _id: { $in: tagIds },
      companyId,
    }).select('_id tagName unit dataType description');

    if (tags.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching tags found for this company' });
    }

    const tagMap = new Map(tags.map((t) => [t._id.toString(), t]));
    const allowedIds = tags.map((t) => t._id.toString());

    let timeSeries = [];
    let statistics = [];

    try {
      const rawData = await queryCustomTimeRange(
        companyId,
        allowedIds,
        start.toISOString(),
        end.toISOString(),
        aggregation
      );

      const grouped = {};
      rawData.forEach((point) => {
        const id = point.tagId?.toString?.() || String(point.tagId);
        if (!grouped[id]) {
          const meta = tagMap.get(id);
          grouped[id] = {
            tagId: id,
            tagName: point.tagName || meta?.tagName || 'Unknown',
            unit: point.unit || meta?.unit || '',
            data: [],
          };
        }
        grouped[id].data.push({ time: point.time, value: point.value });
      });

      timeSeries = Object.values(grouped);

      statistics = allowedIds.map((tagId) => {
        const meta = tagMap.get(tagId);
        const series = grouped[tagId]?.data || [];
        return computeSeriesStats(series, meta || { tagId, tagName: 'Unknown', unit: '' });
      });
    } catch (err) {
      console.error('[x] Production historian query failed:', err.message);
      statistics = tags.map((tag) =>
        computeSeriesStats([], tag)
      );
    }

    res.json({
      success: true,
      report: {
        type: 'production',
        title: 'Production Report',
        generatedAt: new Date(),
        dateRange: { start, end, preset },
        aggregation,
        tags: tags.map((t) => ({
          _id: t._id,
          tagName: t.tagName,
          unit: t.unit,
          description: t.description,
        })),
        statistics,
        timeSeries,
        historianAvailable: true,
      },
    });
  } catch (error) {
    console.error('[x] Production Report Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// ALARM SUMMARY REPORT
// ============================================================================
const getAlarmReport = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      preset = 'last7days',
      startDate,
      endDate,
      priority = null,
    } = req.body;

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    const filter = {
      companyId,
      timestamp: { $gte: start, $lte: end },
    };
    if (priority) filter.priority = String(priority).toUpperCase();

    const history = await AlarmHistory.find(filter).sort({ timestamp: -1 }).limit(5000).lean();

    const triggeredEvents = history.filter((h) => h.event === 'TRIGGERED');
    const clearedEvents = history.filter((h) => h.event === 'CLEARED');
    const ackedEvents = history.filter((h) => h.event === 'ACKNOWLEDGED');

    const byPriority = {
      CRITICAL: triggeredEvents.filter((h) => h.priority === 'CRITICAL').length,
      HIGH: triggeredEvents.filter((h) => h.priority === 'HIGH').length,
      MEDIUM: triggeredEvents.filter((h) => h.priority === 'MEDIUM').length,
      LOW: triggeredEvents.filter((h) => h.priority === 'LOW').length,
    };

    const alarmCounts = {};
    triggeredEvents.forEach((h) => {
      alarmCounts[h.alarmName] = (alarmCounts[h.alarmName] || 0) + 1;
    });
    const topAlarms = Object.entries(alarmCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const hoursDiff = Math.max(1, Math.ceil((end - start) / (60 * 60 * 1000)));
    const bucketSize =
      hoursDiff <= 24 ? 3600000 : hoursDiff <= 168 ? 21600000 : 86400000;

    const buckets = new Map();
    triggeredEvents.forEach((h) => {
      const key = new Date(
        Math.floor(new Date(h.timestamp).getTime() / bucketSize) * bucketSize
      ).toISOString();
      if (!buckets.has(key)) {
        buckets.set(key, {
          time: key,
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
          total: 0,
        });
      }
      const bucket = buckets.get(key);
      if (bucket[h.priority] !== undefined) bucket[h.priority] += 1;
      bucket.total += 1;
    });
    const timeline = Array.from(buckets.values()).sort(
      (a, b) => new Date(a.time) - new Date(b.time)
    );

    const activeAlarms = await Alarm.find({
      companyId,
      isActive: true,
    })
      .sort({ triggeredAt: -1 })
      .lean();

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
          currentlyUnacked: activeAlarms.filter((a) => !a.isAcknowledged).length,
          byPriority,
        },
        topAlarms,
        timeline,
        history: history.slice(0, 500),
        activeAlarms,
        historyTotalCount: history.length,
      },
    });
  } catch (error) {
    console.error('[x] Alarm Report Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// USER ACTIVITY REPORT
// ============================================================================
const getActivityReport = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const {
      preset = 'today',
      startDate,
      endDate,
      username = null,
      action = null,
    } = req.body;

    const { start, end } = resolveDateRange(preset, startDate, endDate);

    const filter = {
      companyId,
      createdAt: { $gte: start, $lte: end },
    };
    if (username) filter.username = username;
    if (action) filter.action = action;

    const logs = await UserActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const byAction = {};
    const byUser = {};
    const successCount = { success: 0, failed: 0 };

    logs.forEach((log) => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byUser[log.username] = (byUser[log.username] || 0) + 1;
      if (log.success) successCount.success += 1;
      else successCount.failed += 1;
    });

    const topUsers = Object.entries(byUser)
      .map(([name, count]) => ({ username: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topActions = Object.entries(byAction)
      .map(([name, count]) => ({ action: name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const loginEvents = logs.filter((l) =>
      ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'].includes(l.action)
    );

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
          loginCount: logs.filter((l) => l.action === 'LOGIN').length,
          failedLoginCount: logs.filter((l) => l.action === 'LOGIN_FAILED').length,
        },
        topUsers,
        topActions,
        loginEvents: loginEvents.slice(0, 200),
        logs: logs.slice(0, 500),
        totalCount: logs.length,
      },
    });
  } catch (error) {
    console.error('[x] Activity Report Error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================================================
// Activity helpers
// ============================================================================
const logActivity = async (data) => {
  try {
    if (!data || !data.companyId || !data.username || !data.action) {
      console.warn('[!] logActivity missing required fields — skipping');
      return;
    }
    await UserActivityLog.create({
      companyId: data.companyId,
      username: data.username,
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
    console.warn('[!] logActivity failed:', err.message);
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = await UserActivityLog.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
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