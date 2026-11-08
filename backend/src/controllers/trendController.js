// ============================================================================
// Trend Controller - Historical Data API (MongoDB Time Series)
// Fully replaces InfluxDB dependency. Strictly multi-tenant.
// ============================================================================

const {
  queryTagHistory,
  queryMultipleTagsHistory,
  queryCustomTimeRange,
  getTagStatistics
} = require('../services/historianService');
const TelemetryLog = require('../models/TelemetryLog');

// Helper: Empty stats object (no data)
const emptyStats = (tagId, timeRange) => ({
  tagId,
  timeRange,
  mean: 0,
  min: 0,
  max: 0,
  count: 0,
  stddev: 0,
  first: null,
  last: null,
  hasData: false,
});

// Utility to get companyId from auth middleware
const getCompanyId = (req) => {
  return req.user?.company || req.companyId || req.user?.companyId;
};

// GET /api/trends/history/:tagId
const getTagHistory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagId } = req.params;
    const { timeRange = '1h', aggregation = '10s' } = req.query;

    const validRanges = ['15m', '30m', '1h', '6h', '12h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        message: `Invalid time range. Valid: ${validRanges.join(', ')}`,
      });
    }

    const data = await queryTagHistory(companyId, tagId, timeRange, aggregation);

    res.json({
      success: true,
      tagId,
      timeRange,
      aggregation,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('[x] Get Tag History Error:', error.message);
    res.json({
      success: true,
      tagId: req.params.tagId,
      timeRange: req.query.timeRange || '1h',
      count: 0,
      data: [],
      message: `History unavailable: ${error.message}`,
    });
  }
};

// POST /api/trends/history/multiple
const getMultipleTagsHistory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagIds, timeRange = '1h', aggregation = '10s' } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ success: false, message: 'tagIds array is required' });
    }

    if (tagIds.length > 10) {
      return res.status(400).json({ success: false, message: 'Maximum 10 tags allowed per request' });
    }

    const data = await queryMultipleTagsHistory(companyId, tagIds, timeRange, aggregation);

    const groupedData = {};
    data.forEach((point) => {
      if (!groupedData[point.tagId]) {
        groupedData[point.tagId] = {
          tagId: point.tagId.toString(),
          tagName: point.tagName,
          unit: point.unit,
          data: [],
        };
      }
      groupedData[point.tagId].data.push({
        time: point.time,
        value: point.value,
      });
    });

    res.json({
      success: true,
      timeRange,
      aggregation,
      tags: Object.values(groupedData),
    });
  } catch (error) {
    console.error('[x] Get Multiple Tags History Error:', error.message);
    res.json({
      success: true,
      tags: [],
      message: `History unavailable: ${error.message}`,
    });
  }
};

// POST /api/trends/history/custom
const getCustomRangeHistory = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagIds, startTime, endTime, aggregation = '1m' } = req.body;

    if (!tagIds || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'tagIds, startTime, endTime are required' });
    }

    const data = await queryCustomTimeRange(companyId, tagIds, startTime, endTime, aggregation);

    const groupedData = {};
    data.forEach((point) => {
      if (!groupedData[point.tagId]) {
        groupedData[point.tagId] = {
          tagId: point.tagId.toString(),
          tagName: point.tagName,
          unit: point.unit,
          data: [],
        };
      }
      groupedData[point.tagId].data.push({
        time: point.time,
        value: point.value,
      });
    });

    res.json({
      success: true,
      startTime,
      endTime,
      aggregation,
      tags: Object.values(groupedData),
    });
  } catch (error) {
    console.error('[x] Custom Range History Error:', error.message);
    res.json({
      success: true,
      tags: [],
      message: `History unavailable: ${error.message}`,
    });
  }
};

// GET /api/trends/stats/:tagId
const getTagStats = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagId } = req.params;
    const { timeRange = '1h' } = req.query;

    const stats = await getTagStatistics(companyId, tagId, timeRange);

    if (!stats) {
      return res.json({ success: true, stats: emptyStats(tagId, timeRange) });
    }

    res.json({
      success: true,
      stats: {
        ...stats,
        range: (stats.max ?? 0) - (stats.min ?? 0),
        hasData: true,
      },
    });
  } catch (error) {
    console.error('[x] Get Tag Stats Error:', error.message);
    res.json({
      success: true,
      stats: emptyStats(req.params.tagId, req.query.timeRange || '1h'),
    });
  }
};

// GET /api/trends/latest/:tagId
const getLatestValue = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagId } = req.params;

    const latestLog = await TelemetryLog.findOne({
      'meta.companyId': companyId,
      'meta.tagId': tagId
    })
      .sort({ timestamp: -1 })
      .lean();

    if (!latestLog) {
      return res.json({ success: true, data: null, message: 'No recent data found' });
    }

    res.json({
      success: true,
      data: {
        time: latestLog.timestamp,
        value: latestLog.value
      },
    });
  } catch (error) {
    console.error('[x] Get Latest Value Error:', error.message);
    res.json({ success: true, data: null, message: error.message });
  }
};

// POST /api/trends/export
const exportTrendCSV = async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const { tagIds, timeRange = '1h', aggregation = '10s', startTime, endTime } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({ success: false, message: 'tagIds array is required' });
    }

    let data = [];
    if (startTime && endTime) {
      data = await queryCustomTimeRange(companyId, tagIds, startTime, endTime, aggregation);
    } else {
      data = await queryMultipleTagsHistory(companyId, tagIds, timeRange, aggregation);
    }

    const grouped = {};
    const tagNames = new Set();

    data.forEach((point) => {
      const timeKey = new Date(point.time).toISOString();
      if (!grouped[timeKey]) grouped[timeKey] = {};
      grouped[timeKey][point.tagName] = point.value;
      tagNames.add(point.tagName);
    });

    const tagNameArray = Array.from(tagNames);
    const timeKeys = Object.keys(grouped).sort();

    const escape = (v) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const header = `# OnlineSCADA Trend Export\n# Generated: ${new Date().toISOString()}\n# Range: ${startTime ? `${startTime} → ${endTime}` : timeRange}\n# Aggregation: ${aggregation}\n# Tags: ${tagNameArray.length}\n# Points: ${timeKeys.length}\n\n`;
    const headerRow = ['Timestamp', ...tagNameArray].map(escape).join(',');
    const rows = timeKeys.map((t) =>
      [t, ...tagNameArray.map((name) => grouped[t][name] ?? '')].map(escape).join(',')
    );

    const csv = header + [headerRow, ...rows].join('\n');
    const filename = `trend_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('[x] Export CSV Error:', error.message);
    res.status(500).json({ success: false, message: `Export failed: ${error.message}` });
  }
};

module.exports = {
  getTagHistory,
  getMultipleTagsHistory,
  getCustomRangeHistory,
  getTagStats,
  getLatestValue,
  exportTrendCSV,
};