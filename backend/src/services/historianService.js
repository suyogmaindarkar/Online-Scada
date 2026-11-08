// ============================================================================
// Historian Service - MongoDB Aggregation Engine
// Handles high-performance time-series querying and downsampling.
// ============================================================================

const mongoose = require('mongoose');
const TelemetryLog = require('../models/TelemetryLog');
const Tag = require('../models/Tag');

// Parse time range string (e.g., '1h', '30m', '7d') into a past Date object
const parseTimeRange = (rangeStr) => {
    const now = Date.now();
    const value = parseInt(rangeStr.slice(0, -1), 10);
    const unit = rangeStr.slice(-1);

    let ms = 60 * 60 * 1000; // Default 1 hour
    if (unit === 'm') ms = value * 60 * 1000;
    if (unit === 'h') ms = value * 60 * 60 * 1000;
    if (unit === 'd') ms = value * 24 * 60 * 60 * 1000;

    return new Date(now - ms);
};

// Parse aggregation string (e.g., '10s', '1m') into MongoDB $dateTrunc parameters
const parseAggregation = (aggStr) => {
    const value = parseInt(aggStr.slice(0, -1), 10);
    const unitStr = aggStr.slice(-1);

    let unit = 'second';
    if (unitStr === 'm') unit = 'minute';
    if (unitStr === 'h') unit = 'hour';
    if (unitStr === 'd') unit = 'day';

    return { unit, binSize: value || 1 };
};

// Log a new telemetry point (Call this from your Factory Connector ingestion route)
const logTelemetry = async (companyId, tagId, value, quality = 'GOOD') => {
    try {
        // Ensure value is numeric for trend charting
        const numericValue = Number(value);
        if (isNaN(numericValue)) return null;

        const log = new TelemetryLog({
            timestamp: new Date(),
            meta: { companyId, tagId },
            value: numericValue,
            quality
        });
        await log.save();
        return log;
    } catch (error) {
        console.error('[!] Telemetry Logging Error:', error.message);
        throw error;
    }
};

// Query history for a single tag with aggregation
const queryTagHistory = async (companyId, tagId, timeRange, aggregation) => {
    const startTime = parseTimeRange(timeRange);
    const { unit, binSize } = parseAggregation(aggregation);

    const pipeline = [
        {
            $match: {
                'meta.companyId': new mongoose.Types.ObjectId(companyId),
                'meta.tagId': new mongoose.Types.ObjectId(tagId),
                timestamp: { $gte: startTime }
            }
        },
        {
            $group: {
                _id: { $dateTrunc: { date: '$timestamp', unit: unit, binSize: binSize } },
                value: { $avg: '$value' }
            }
        },
        { $sort: { '_id': 1 } },
        {
            $project: {
                time: '$_id',
                value: { $round: ['$value', 4] },
                _id: 0
            }
        }
    ];

    return await TelemetryLog.aggregate(pipeline);
};

// Query history for multiple tags
const queryMultipleTagsHistory = async (companyId, tagIds, timeRange, aggregation) => {
    const startTime = parseTimeRange(timeRange);
    const { unit, binSize } = parseAggregation(aggregation);
    const objectIdTagIds = tagIds.map(id => new mongoose.Types.ObjectId(id));

    // Fetch tag metadata to include names and units in the response
    const tagsMeta = await Tag.find({ _id: { $in: objectIdTagIds }, companyId }).lean();
    const tagMetaMap = {};
    tagsMeta.forEach(t => { tagMetaMap[t._id.toString()] = { name: t.tagName, unit: t.unit }; });

    const pipeline = [
        {
            $match: {
                'meta.companyId': new mongoose.Types.ObjectId(companyId),
                'meta.tagId': { $in: objectIdTagIds },
                timestamp: { $gte: startTime }
            }
        },
        {
            $group: {
                _id: {
                    tagId: '$meta.tagId',
                    timeBucket: { $dateTrunc: { date: '$timestamp', unit: unit, binSize: binSize } }
                },
                value: { $avg: '$value' }
            }
        },
        { $sort: { '_id.timeBucket': 1 } },
        {
            $project: {
                tagId: '$_id.tagId',
                time: '$_id.timeBucket',
                value: { $round: ['$value', 4] },
                _id: 0
            }
        }
    ];

    const results = await TelemetryLog.aggregate(pipeline);

    // Map results to include tag names
    return results.map(r => ({
        tagId: r.tagId,
        tagName: tagMetaMap[r.tagId.toString()]?.name || 'Unknown',
        unit: tagMetaMap[r.tagId.toString()]?.unit || '',
        time: r.time,
        value: r.value
    }));
};

// Query history for a custom time range
const queryCustomTimeRange = async (companyId, tagIds, startTime, endTime, aggregation) => {
    const { unit, binSize } = parseAggregation(aggregation);
    const objectIdTagIds = tagIds.map(id => new mongoose.Types.ObjectId(id));

    const tagsMeta = await Tag.find({ _id: { $in: objectIdTagIds }, companyId }).lean();
    const tagMetaMap = {};
    tagsMeta.forEach(t => { tagMetaMap[t._id.toString()] = { name: t.tagName, unit: t.unit }; });

    const pipeline = [
        {
            $match: {
                'meta.companyId': new mongoose.Types.ObjectId(companyId),
                'meta.tagId': { $in: objectIdTagIds },
                timestamp: { $gte: new Date(startTime), $lte: new Date(endTime) }
            }
        },
        {
            $group: {
                _id: {
                    tagId: '$meta.tagId',
                    timeBucket: { $dateTrunc: { date: '$timestamp', unit: unit, binSize: binSize } }
                },
                value: { $avg: '$value' }
            }
        },
        { $sort: { '_id.timeBucket': 1 } },
        {
            $project: {
                tagId: '$_id.tagId',
                time: '$_id.timeBucket',
                value: { $round: ['$value', 4] },
                _id: 0
            }
        }
    ];

    const results = await TelemetryLog.aggregate(pipeline);

    return results.map(r => ({
        tagId: r.tagId,
        tagName: tagMetaMap[r.tagId.toString()]?.name || 'Unknown',
        unit: tagMetaMap[r.tagId.toString()]?.unit || '',
        time: r.time,
        value: r.value
    }));
};

// Get statistics (Min, Max, Avg, StdDev) for a single tag
const getTagStatistics = async (companyId, tagId, timeRange) => {
    const startTime = parseTimeRange(timeRange);

    const pipeline = [
        {
            $match: {
                'meta.companyId': new mongoose.Types.ObjectId(companyId),
                'meta.tagId': new mongoose.Types.ObjectId(tagId),
                timestamp: { $gte: startTime }
            }
        },
        {
            $group: {
                _id: null,
                min: { $min: '$value' },
                max: { $max: '$value' },
                mean: { $avg: '$value' },
                count: { $sum: 1 },
                stddev: { $stdDevPop: '$value' },
                first: { $first: '$value' },
                last: { $last: '$value' }
            }
        }
    ];

    const results = await TelemetryLog.aggregate(pipeline);
    if (results.length === 0) return null;

    const stats = results[0];
    delete stats._id;

    // Round values for UI
    return {
        min: Number(stats.min.toFixed(4)),
        max: Number(stats.max.toFixed(4)),
        mean: Number(stats.mean.toFixed(4)),
        count: stats.count,
        stddev: Number((stats.stddev || 0).toFixed(4)),
        first: Number(stats.first.toFixed(4)),
        last: Number(stats.last.toFixed(4))
    };
};

module.exports = {
    logTelemetry,
    queryTagHistory,
    queryMultipleTagsHistory,
    queryCustomTimeRange,
    getTagStatistics
};