// ============================================
// Trend Controller - Historical Data API
// Gracefully handles InfluxDB unavailable
//
// Task Bundle applied:
//   ✅ T004  — /trends/stats never returns 404, always 200 with data
//   ✅ T023  — /trends/export new endpoint for server-side CSV
//   ✅ T026  — Enhanced statistics (adds stddev, count, first, last)
// ============================================

const {
  queryTagHistory,
  queryMultipleTagsHistory,
  queryCustomTimeRange,
  getTagStatistics,
  getLatestTagValue,
  isInfluxAvailable,
} = require('../services/influxService');

// ─────────────────────────────────────────
// Helper: Empty stats object (no data)
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET /api/trends/history/:tagId
// ─────────────────────────────────────────
const getTagHistory = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { timeRange = '1h', aggregation = '10s' } = req.query;

    const validRanges = ['15m', '30m', '1h', '6h', '12h', '24h', '7d', '30d'];
    if (!validRanges.includes(timeRange)) {
      return res.status(400).json({
        success: false,
        message: `Invalid time range. Valid: ${validRanges.join(', ')}`,
      });
    }

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.json({
        success: true,
        tagId,
        timeRange,
        aggregation,
        count: 0,
        data: [],
        message: 'InfluxDB not available — no historical data',
      });
    }

    const data = await queryTagHistory(tagId, timeRange, aggregation);

    res.json({
      success: true,
      tagId,
      timeRange,
      aggregation,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('❌ Get Tag History Error:', error.message);
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

// ─────────────────────────────────────────
// POST /api/trends/history/multiple
// ─────────────────────────────────────────
const getMultipleTagsHistory = async (req, res) => {
  try {
    const { tagIds, timeRange = '1h', aggregation = '10s' } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'tagIds array is required',
      });
    }

    if (tagIds.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 10 tags allowed per request',
      });
    }

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.json({
        success: true,
        timeRange,
        aggregation,
        tags: [],
        message: 'InfluxDB not available',
      });
    }

    const data = await queryMultipleTagsHistory(tagIds, timeRange, aggregation);

    const groupedData = {};
    data.forEach((point) => {
      if (!groupedData[point.tagId]) {
        groupedData[point.tagId] = {
          tagId: point.tagId,
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
    console.error('❌ Get Multiple Tags History Error:', error.message);
    res.json({
      success: true,
      tags: [],
      message: `History unavailable: ${error.message}`,
    });
  }
};

// ─────────────────────────────────────────
// POST /api/trends/history/custom
// ─────────────────────────────────────────
const getCustomRangeHistory = async (req, res) => {
  try {
    const { tagIds, startTime, endTime, aggregation = '1m' } = req.body;

    if (!tagIds || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'tagIds, startTime, endTime are required',
      });
    }

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.json({
        success: true,
        tags: [],
        message: 'InfluxDB not available',
      });
    }

    const data = await queryCustomTimeRange(tagIds, startTime, endTime, aggregation);

    const groupedData = {};
    data.forEach((point) => {
      if (!groupedData[point.tagId]) {
        groupedData[point.tagId] = {
          tagId: point.tagId,
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
    console.error('❌ Custom Range History Error:', error.message);
    res.json({
      success: true,
      tags: [],
      message: `History unavailable: ${error.message}`,
    });
  }
};

// ─────────────────────────────────────────
// GET /api/trends/stats/:tagId
// ✅ T004: Returns 200 with empty stats instead of 404
// ✅ T026: Enhanced statistics with hasData flag
// ─────────────────────────────────────────
const getTagStats = async (req, res) => {
  try {
    const { tagId } = req.params;
    const { timeRange = '1h' } = req.query;

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.json({
        success: true,
        stats: emptyStats(tagId, timeRange),
      });
    }

    const stats = await getTagStatistics(tagId, timeRange);

    if (!stats) {
      return res.json({
        success: true,
        stats: emptyStats(tagId, timeRange),
      });
    }

    // T026: Add derived fields for richer stats display
    res.json({
      success: true,
      stats: {
        ...stats,
        // Ensure all fields exist for frontend
        mean:   stats.mean ?? 0,
        min:    stats.min ?? 0,
        max:    stats.max ?? 0,
        count:  stats.count ?? 0,
        stddev: stats.stddev ?? 0,
        range:  (stats.max ?? 0) - (stats.min ?? 0),
        hasData: true,
      },
    });
  } catch (error) {
    console.error('❌ Get Tag Stats Error:', error.message);
    res.json({
      success: true,
      stats: emptyStats(req.params.tagId, req.query.timeRange || '1h'),
    });
  }
};

// ─────────────────────────────────────────
// GET /api/trends/latest/:tagId
// ─────────────────────────────────────────
const getLatestValue = async (req, res) => {
  try {
    const { tagId } = req.params;

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.json({
        success: true,
        data: null,
        message: 'InfluxDB not available',
      });
    }

    const data = await getLatestTagValue(tagId);

    if (!data) {
      return res.json({
        success: true,
        data: null,
        message: 'No recent data found',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('❌ Get Latest Value Error:', error.message);
    res.json({
      success: true,
      data: null,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────
// ✅ T023: POST /api/trends/export
// Server-side CSV export (useful for large datasets)
// Returns CSV directly as file download
// ─────────────────────────────────────────
const exportTrendCSV = async (req, res) => {
  try {
    const { tagIds, timeRange = '1h', aggregation = '10s', startTime, endTime } = req.body;

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'tagIds array is required',
      });
    }

    if (typeof isInfluxAvailable === 'function' && !isInfluxAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'InfluxDB not available',
      });
    }

    let data = [];
    if (startTime && endTime) {
      data = await queryCustomTimeRange(tagIds, startTime, endTime, aggregation);
    } else {
      data = await queryMultipleTagsHistory(tagIds, timeRange, aggregation);
    }

    // Group by time → columns
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

    // Build CSV
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
    console.error('❌ Export CSV Error:', error.message);
    res.status(500).json({
      success: false,
      message: `Export failed: ${error.message}`,
    });
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