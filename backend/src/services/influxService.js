// ============================================
// InfluxDB Service - Time Series Data Handler
// With graceful fallback when InfluxDB is offline
//
// Task Bundle applied:
//   ✅ T026  — Enhanced statistics (adds stddev, count)
// ============================================

const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN;
const org = process.env.INFLUX_ORG;
const bucket = process.env.INFLUX_BUCKET || 'scada_trends';

let influxDB = null;
let writeApi = null;
let queryApi = null;

// ─── Connection State Tracking (anti-spam) ───
let isAvailable = false;
let lastErrorLogged = 0;
let lastHealthCheck = 0;
const ERROR_LOG_INTERVAL = 60_000;
const HEALTH_CHECK_INTERVAL = 30_000;

// ─────────────────────────────────────────
// Initialize InfluxDB
// ─────────────────────────────────────────
const initInflux = async () => {
  try {
    if (!token || !org) {
      console.warn('⚠️  InfluxDB env vars missing (INFLUX_TOKEN / INFLUX_ORG)');
      console.warn('    → Trend logging will be DISABLED.');
      console.warn('    → All other features (PLC, tags, alarms) will work normally.');
      isAvailable = false;
      return false;
    }

    influxDB = new InfluxDB({ url, token });
    writeApi = influxDB.getWriteApi(org, bucket, 'ms');
    writeApi.useDefaultTags({
      source: 'web-scada',
      version: '1.0',
    });
    queryApi = influxDB.getQueryApi(org);

    const healthy = await checkHealth();
    if (healthy) {
      isAvailable = true;
      console.log('✅ InfluxDB Connected Successfully');
      console.log(`   URL: ${url} | Org: ${org} | Bucket: ${bucket}`);
    } else {
      isAvailable = false;
      console.warn('⚠️  InfluxDB unreachable — trend logging DISABLED');
      console.warn('    → System will keep retrying silently in background.');
    }
    return isAvailable;
  } catch (error) {
    isAvailable = false;
    console.warn('⚠️  InfluxDB init failed:', error.message);
    return false;
  }
};

const checkHealth = async () => {
  try {
    const res = await fetch(`${url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

const maybeRecheck = async () => {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) return isAvailable;
  lastHealthCheck = now;

  const healthy = await checkHealth();
  if (healthy && !isAvailable) {
    isAvailable = true;
    console.log('✅ InfluxDB is back online — trend logging resumed');
  } else if (!healthy && isAvailable) {
    isAvailable = false;
    console.warn('⚠️  InfluxDB went offline — trend logging paused');
  }
  return isAvailable;
};

const logErrorOnce = (msg) => {
  const now = Date.now();
  if (now - lastErrorLogged > ERROR_LOG_INTERVAL) {
    console.warn(`⚠️  ${msg} (suppressing further messages for 60s)`);
    lastErrorLogged = now;
  }
};

// ─────────────────────────────────────────
// Write Single Tag Value
// ─────────────────────────────────────────
const writeTagValue = async (tagData) => {
  if (!writeApi) return false;
  await maybeRecheck();
  if (!isAvailable) return false;

  try {
    const { tagId, tagName, value, unit = '', plcId = 'unknown', quality = 'good' } = tagData;

    const point = new Point('tag_values')
      .tag('tag_id', tagId.toString())
      .tag('tag_name', tagName)
      .tag('plc_id', plcId.toString())
      .tag('unit', unit)
      .tag('quality', quality)
      .floatField('value', parseFloat(value))
      .timestamp(new Date());

    writeApi.writePoint(point);
    return true;
  } catch (error) {
    isAvailable = false;
    logErrorOnce(`InfluxDB write failed: ${error.message}`);
    return false;
  }
};

// ─────────────────────────────────────────
// Write Multiple Tag Values (Batch)
// ─────────────────────────────────────────
const writeMultipleTagValues = async (tagsArray) => {
  if (!writeApi) return false;
  await maybeRecheck();
  if (!isAvailable) return false;

  try {
    const points = tagsArray.map((tagData) => {
      const { tagId, tagName, value, unit = '', plcId = 'unknown', quality = 'good' } = tagData;

      return new Point('tag_values')
        .tag('tag_id', tagId.toString())
        .tag('tag_name', tagName)
        .tag('plc_id', plcId.toString())
        .tag('unit', unit)
        .tag('quality', quality)
        .floatField('value', parseFloat(value))
        .timestamp(new Date());
    });

    writeApi.writePoints(points);
    return true;
  } catch (error) {
    isAvailable = false;
    logErrorOnce(`InfluxDB batch write failed: ${error.message}`);
    return false;
  }
};

// ─────────────────────────────────────────
// Query Tag History
// ─────────────────────────────────────────
const queryTagHistory = async (tagId, timeRange = '1h', aggregation = '10s') => {
  if (!queryApi || !isAvailable) return [];

  try {
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "tag_values")
        |> filter(fn: (r) => r.tag_id == "${tagId}")
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${aggregation}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            time: obj._time,
            value: parseFloat(obj._value.toFixed(4)),
            tagId: obj.tag_id,
            tagName: obj.tag_name,
            unit: obj.unit,
          });
        },
        error(error) {
          console.error('❌ Query Error:', error.message);
          reject(error);
        },
        complete: resolve,
      });
    });
    return results;
  } catch (error) {
    console.error('❌ InfluxDB Query Error:', error.message);
    return [];
  }
};

// ─────────────────────────────────────────
// Query Multiple Tags History
// ─────────────────────────────────────────
const queryMultipleTagsHistory = async (tagIds, timeRange = '1h', aggregation = '10s') => {
  if (!queryApi || !isAvailable || !tagIds.length) return [];

  try {
    const tagFilter = tagIds.map((id) => `r.tag_id == "${id}"`).join(' or ');
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -${timeRange})
        |> filter(fn: (r) => r._measurement == "tag_values")
        |> filter(fn: (r) => ${tagFilter})
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${aggregation}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            time: obj._time,
            value: parseFloat(obj._value.toFixed(4)),
            tagId: obj.tag_id,
            tagName: obj.tag_name,
            unit: obj.unit,
          });
        },
        error: reject,
        complete: resolve,
      });
    });
    return results;
  } catch (error) {
    console.error('❌ InfluxDB Multi-Query Error:', error.message);
    return [];
  }
};

// ─────────────────────────────────────────
// Query Custom Time Range
// ─────────────────────────────────────────
const queryCustomTimeRange = async (tagIds, startTime, endTime, aggregation = '1m') => {
  if (!queryApi || !isAvailable) return [];

  try {
    const tagFilter = tagIds.map((id) => `r.tag_id == "${id}"`).join(' or ');
    const query = `
      from(bucket: "${bucket}")
        |> range(start: ${startTime}, stop: ${endTime})
        |> filter(fn: (r) => r._measurement == "tag_values")
        |> filter(fn: (r) => ${tagFilter})
        |> filter(fn: (r) => r._field == "value")
        |> aggregateWindow(every: ${aggregation}, fn: mean, createEmpty: false)
        |> yield(name: "mean")
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            time: obj._time,
            value: parseFloat(obj._value.toFixed(4)),
            tagId: obj.tag_id,
            tagName: obj.tag_name,
            unit: obj.unit,
          });
        },
        error: reject,
        complete: resolve,
      });
    });
    return results;
  } catch (error) {
    console.error('❌ InfluxDB Custom Range Error:', error.message);
    return [];
  }
};

// ─────────────────────────────────────────
// Get Latest Value of Tag
// ─────────────────────────────────────────
const getLatestTagValue = async (tagId) => {
  if (!queryApi || !isAvailable) return null;

  try {
    const query = `
      from(bucket: "${bucket}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "tag_values")
        |> filter(fn: (r) => r.tag_id == "${tagId}")
        |> filter(fn: (r) => r._field == "value")
        |> last()
    `;

    const results = [];
    await new Promise((resolve, reject) => {
      queryApi.queryRows(query, {
        next(row, tableMeta) {
          const obj = tableMeta.toObject(row);
          results.push({
            time: obj._time,
            value: parseFloat(obj._value),
            tagId: obj.tag_id,
            tagName: obj.tag_name,
          });
        },
        error: reject,
        complete: resolve,
      });
    });
    return results[0] || null;
  } catch (error) {
    console.error('❌ Get Latest Value Error:', error.message);
    return null;
  }
};

// ─────────────────────────────────────────
// ✅ T026: Enhanced Statistics
// Returns mean, min, max, stddev, count, first, last
// ─────────────────────────────────────────
const getTagStatistics = async (tagId, timeRange = '1h') => {
  if (!queryApi || !isAvailable) return null;

  try {
    const queries = {
      mean: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> mean()
      `,
      min: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> min()
      `,
      max: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> max()
      `,
      // ✅ T026 additions
      stddev: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> stddev()
      `,
      count: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> count()
      `,
      first: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> first()
      `,
      last: `
        from(bucket: "${bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "tag_values")
          |> filter(fn: (r) => r.tag_id == "${tagId}")
          |> filter(fn: (r) => r._field == "value")
          |> last()
      `,
    };

    const getResult = (query) =>
      new Promise((resolve, reject) => {
        const results = [];
        queryApi.queryRows(query, {
          next(row, tableMeta) {
            const obj = tableMeta.toObject(row);
            const val = obj._value;
            results.push(typeof val === 'number' ? parseFloat(val.toFixed(4)) : val);
          },
          error: reject,
          complete() {
            resolve(results[0] ?? 0);
          },
        });
      });

    const [mean, min, max, stddev, count, first, last] = await Promise.all([
      getResult(queries.mean),
      getResult(queries.min),
      getResult(queries.max),
      getResult(queries.stddev).catch(() => 0),
      getResult(queries.count).catch(() => 0),
      getResult(queries.first).catch(() => null),
      getResult(queries.last).catch(() => null),
    ]);

    return {
      mean,
      min,
      max,
      stddev,
      count: Math.round(count),
      first,
      last,
      range: max - min,
      tagId,
      timeRange,
    };
  } catch (error) {
    console.error('❌ Statistics Error:', error.message);
    return null;
  }
};

// ─────────────────────────────────────────
// Close Connection
// ─────────────────────────────────────────
const closeInflux = async () => {
  try {
    if (writeApi) {
      await writeApi.close();
      console.log('✅ InfluxDB Write API closed');
    }
  } catch (error) {
    console.error('❌ InfluxDB Close Error:', error.message);
  }
};

const isInfluxAvailable = () => isAvailable;

module.exports = {
  initInflux,
  writeTagValue,
  writeMultipleTagValues,
  queryTagHistory,
  queryMultipleTagsHistory,
  queryCustomTimeRange,
  getLatestTagValue,
  getTagStatistics,
  closeInflux,
  isInfluxAvailable,
};