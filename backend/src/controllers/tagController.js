// ═══════════════════════════════════════════════════════════
// Tag Controller
//
// Task Bundle applied:
//   ✅ T060  — Bulk import from CSV with validation & summary
//   ✅ T061  — Bulk export to CSV (all fields)
//   ✅ BONUS — CSV template download
// ═══════════════════════════════════════════════════════════

const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');

// ─────────────────────────────────────────────────────────
// CSV UTILITIES (lightweight, forgiving parser)
// ─────────────────────────────────────────────────────────

/** Escape a value for CSV (handles commas, quotes, newlines) */
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

/**
 * Parse a single CSV line respecting quoted fields.
 * Handles: unquoted, "quoted", "with, commas", "with ""escaped"" quotes"
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"' && current === '') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        result.push(current);
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  result.push(current);
  return result.map(s => s.trim());
};

/**
 * Parse full CSV text into { headers, rows }
 * HARDENED VERSION:
 *   • Strips UTF-8 BOM (multiple formats)
 *   • Skips empty/whitespace-only lines
 *   • Skips comment lines starting with # (even with leading whitespace)
 *   • Case-INSENSITIVE header matching (tagName, TagName, TAGNAME all match)
 *   • Trims header names
 */
const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== 'string') {
    return { headers: [], rows: [], rawHeaders: [] };
  }

  // Strip ALL BOM variants (UTF-8, UTF-16 LE/BE, UTF-32)
  let cleaned = csvText
    .replace(/^\uFEFF/, '')      // UTF-8 BOM
    .replace(/^\uFFFE/, '')      // UTF-16 BE BOM (rare)
    .replace(/^\u00EF\u00BB\u00BF/, ''); // UTF-8 BOM as bytes (Excel weirdness)

  // Normalize line endings
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines, filter out empty and comment lines
  const lines = cleaned.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;         // Skip blank lines
    if (trimmed.startsWith('#')) return false;      // Skip comment lines
    return true;
  });

  if (lines.length === 0) {
    return { headers: [], rows: [], rawHeaders: [] };
  }

  // Parse header row
  const rawHeaders = parseCSVLine(lines[0]);

  // Normalize headers: trim + preserve original for error messages
  const headers = rawHeaders.map((h) => h.trim());

  // Parse data rows
  const rows = lines.slice(1).map((line) => {
    const cells = parseCSVLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = cells[idx] !== undefined ? cells[idx] : '';
    });
    return row;
  });

  return { headers, rows, rawHeaders };
};

/** Case-insensitive header lookup helper */
const findHeader = (headers, target) => {
  const lower = target.toLowerCase();
  return headers.find(h => h.toLowerCase() === lower);
};

// ═══════════════════════════════════════════════════════════
// CREATE TAG
// ═══════════════════════════════════════════════════════════
const createTag = async (req, res) => {
  try {
    const {
      tagName, description, group, dataType, plcConnection, plcAddress,
      accessType, unit, minValue, maxValue,
      enableScaling, rawMin, rawMax, scaledMin, scaledMax,
      enableLogging, loggingInterval, enableAlarm,
    } = req.body;

    if (!tagName || !dataType) {
      return res.status(400).json({
        success: false,
        message: 'Tag name and data type are required',
      });
    }

    const exists = await Tag.findOne({ tagName: tagName.toUpperCase() });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Tag with this name already exists',
      });
    }

    if (plcConnection) {
      const plcExists = await PLCConnection.findById(plcConnection);
      if (!plcExists) {
        return res.status(404).json({
          success: false,
          message: 'PLC not found',
        });
      }
    }

    let defaultValue = 0;
    if (dataType === 'BOOL') defaultValue = false;
    if (dataType === 'STRING') defaultValue = '';

    const tag = await Tag.create({
      tagName: tagName.toUpperCase(),
      description: description || '',
      group: group || 'Default',
      dataType,
      plcConnection: plcConnection || null,
      plcAddress: plcAddress || '',
      accessType: accessType || 'READ_WRITE',
      currentValue: defaultValue,
      unit: unit || '',
      minValue: minValue || 0,
      maxValue: maxValue || 100,
      enableScaling: enableScaling || false,
      rawMin: rawMin || 0,
      rawMax: rawMax || 32767,
      scaledMin: scaledMin || 0,
      scaledMax: scaledMax || 100,
      enableLogging: enableLogging || false,
      loggingInterval: loggingInterval || 1000,
      enableAlarm: enableAlarm || false,
    });

    res.status(201).json({
      success: true,
      message: 'Tag created successfully',
      data: tag,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET ALL TAGS
// ═══════════════════════════════════════════════════════════
const getAllTags = async (req, res) => {
  try {
    const { group, dataType, search, plcId } = req.query;

    const filter = {};
    if (group) filter.group = group;
    if (dataType) filter.dataType = dataType;
    if (plcId) filter.plcConnection = plcId;
    if (search) {
      filter.$or = [
        { tagName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const tags = await Tag.find(filter)
      .populate('plcConnection', 'name protocol')
      .sort({ tagName: 1 });

    res.json({
      success: true,
      count: tags.length,
      data: tags,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE TAG
// ═══════════════════════════════════════════════════════════
const getTag = async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id).populate('plcConnection', 'name protocol ipAddress');
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }
    res.json({ success: true, data: tag });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE TAG
// ═══════════════════════════════════════════════════════════
const updateTag = async (req, res) => {
  try {
    if (req.body.tagName) req.body.tagName = req.body.tagName.toUpperCase();

    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }

    res.json({
      success: true,
      message: 'Tag updated successfully',
      data: tag,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE TAG
// ═══════════════════════════════════════════════════════════
const deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) {
      return res.status(404).json({ success: false, message: 'Tag not found' });
    }
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// WRITE VALUE TO TAG
// ═══════════════════════════════════════════════════════════
const writeTagValue = async (req, res) => {
  try {
    const { tagName, value } = req.body;

    if (!tagName || value === undefined) {
      return res.status(400).json({ success: false, message: 'Tag name and value are required' });
    }

    const tag = await Tag.findOne({ tagName: tagName.toUpperCase() }).populate('plcConnection');
    if (!tag) {
      return res.status(404).json({ success: false, message: `Tag "${tagName}" not found` });
    }

    if (tag.accessType === 'READ') {
      return res.status(403).json({ success: false, message: 'Tag is read-only' });
    }

    // Normalize value based on data type
    let normalizedValue = value;
    if (tag.dataType === 'BOOL') {
      normalizedValue = typeof value === 'string'
        ? value === 'true' || value === '1'
        : Boolean(value);
    } else if (['INT', 'DINT', 'REAL', 'WORD', 'DWORD', 'BYTE'].includes(tag.dataType)) {
      normalizedValue = Number(value);
      if (isNaN(normalizedValue)) {
        return res.status(400).json({
          success: false,
          message: `Value "${value}" is not a valid number for ${tag.dataType}`,
        });
      }
    }

    console.log(`📝 Write request: ${tag.tagName} = ${normalizedValue} (${tag.dataType})`);

    if (tag.plcConnection && tag.plcAddress) {
      try {
        const plcManager = require('../services/plcManager');
        await plcManager.writeTag(tag, normalizedValue);
        console.log(`✅ PLC write success: ${tag.tagName} = ${normalizedValue}`);
      } catch (plcErr) {
        console.error(`❌ PLC write failed for ${tag.tagName}: ${plcErr.message}`);
        return res.status(500).json({
          success: false,
          message: `PLC write failed: ${plcErr.message}`,
        });
      }
    } else {
      console.log(`ℹ️  ${tag.tagName} is HMI-only (no PLC), updating MongoDB only`);
    }

    tag.currentValue = normalizedValue;
    tag.lastUpdated = Date.now();
    await tag.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('tagsUpdate', [{
        tagName: tag.tagName,
        value: tag.currentValue,
        quality: tag.quality,
        timestamp: tag.lastUpdated,
      }]);
    }

    res.json({
      success: true,
      message: 'Tag value written successfully',
      data: {
        tagName: tag.tagName,
        value: tag.currentValue,
        timestamp: tag.lastUpdated,
      },
    });
  } catch (error) {
    console.error('❌ writeTagValue error:', error.message);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET TAG GROUPS
// ═══════════════════════════════════════════════════════════
const getTagGroups = async (req, res) => {
  try {
    const groups = await Tag.distinct('group');

    const groupsWithCount = await Promise.all(
      groups.map(async (group) => {
        const count = await Tag.countDocuments({ group });
        return { name: group, count };
      })
    );

    res.json({
      success: true,
      count: groups.length,
      data: groupsWithCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// BULK CREATE TAGS (JSON array)
// ═══════════════════════════════════════════════════════════
const bulkCreateTags = async (req, res) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide array of tags' });
    }

    const results = { created: [], failed: [] };

    for (const tagData of tags) {
      try {
        if (tagData.tagName) tagData.tagName = tagData.tagName.toUpperCase();
        const tag = await Tag.create(tagData);
        results.created.push(tag.tagName);
      } catch (error) {
        results.failed.push({
          tagName: tagData.tagName,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Created ${results.created.length} tags, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ T061: EXPORT ALL TAGS AS CSV
// GET /api/tags/export/csv?group=Motors&plcId=xxx
// ═══════════════════════════════════════════════════════════
const exportTagsCSV = async (req, res) => {
  try {
    const { group, dataType, plcId } = req.query;

    const filter = {};
    if (group) filter.group = group;
    if (dataType) filter.dataType = dataType;
    if (plcId) filter.plcConnection = plcId;

    // Exclude simulation tags from export (they auto-regenerate)
    filter.isSimulationTag = { $ne: true };

    const tags = await Tag.find(filter)
      .populate('plcConnection', 'name')
      .sort({ tagName: 1 });

    // ─── CSV Header (matches import template exactly) ───
    const headers = [
      'tagName',
      'description',
      'group',
      'dataType',
      'plcName',        // Reference PLC by name (not ID) so imports work across systems
      'plcAddress',
      'accessType',
      'unit',
      'minValue',
      'maxValue',
      'enableScaling',
      'rawMin',
      'rawMax',
      'scaledMin',
      'scaledMax',
      'enableLogging',
      'loggingInterval',
      'enableAlarm',
    ];

    // ─── Metadata header (as comments) ───
    let csv = '';
    csv += `# OnlineSCADA Tag Export\n`;
    csv += `# Generated: ${new Date().toISOString()}\n`;
    csv += `# Total Tags: ${tags.length}\n`;
    if (group) csv += `# Group Filter: ${group}\n`;
    if (dataType) csv += `# DataType Filter: ${dataType}\n`;
    if (plcId) csv += `# PLC Filter: ${plcId}\n`;
    csv += `# Note: Lines starting with # are ignored during import.\n`;
    csv += `#\n\n`;

    // ─── Header row ───
    csv += headers.join(',') + '\n';

    // ─── Data rows ───
    tags.forEach(tag => {
      const row = [
        csvEscape(tag.tagName),
        csvEscape(tag.description || ''),
        csvEscape(tag.group || ''),
        csvEscape(tag.dataType || 'INT'),
        csvEscape(tag.plcConnection?.name || ''),
        csvEscape(tag.plcAddress || ''),
        csvEscape(tag.accessType || 'READ_WRITE'),
        csvEscape(tag.unit || ''),
        csvEscape(tag.minValue ?? 0),
        csvEscape(tag.maxValue ?? 100),
        csvEscape(tag.enableScaling ? 'true' : 'false'),
        csvEscape(tag.rawMin ?? 0),
        csvEscape(tag.rawMax ?? 32767),
        csvEscape(tag.scaledMin ?? 0),
        csvEscape(tag.scaledMax ?? 100),
        csvEscape(tag.enableLogging ? 'true' : 'false'),
        csvEscape(tag.loggingInterval ?? 1000),
        csvEscape(tag.enableAlarm ? 'true' : 'false'),
      ];
      csv += row.join(',') + '\n';
    });

    const filename = `tags_export_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export Tags CSV Error:', error);
    res.status(500).json({ success: false, message: 'Failed to export tags', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// ✅ BONUS: DOWNLOAD CSV TEMPLATE (blank with example rows)
// GET /api/tags/template/csv
// ═══════════════════════════════════════════════════════════
const downloadTagTemplate = async (req, res) => {
  const headers = [
    'tagName', 'description', 'group', 'dataType', 'plcName', 'plcAddress',
    'accessType', 'unit', 'minValue', 'maxValue',
    'enableScaling', 'rawMin', 'rawMax', 'scaledMin', 'scaledMax',
    'enableLogging', 'loggingInterval', 'enableAlarm',
  ];

  const template = `# OnlineSCADA Tag Import Template
#
# INSTRUCTIONS:
#   1. Fill each row with your tag data
#   2. Required fields: tagName, dataType
#   3. Valid dataType values: BOOL, INT, DINT, REAL, STRING, WORD, DWORD, BYTE
#   4. Valid accessType values: READ, WRITE, READ_WRITE
#   5. plcName should match an existing PLC name (or leave blank for HMI-only tag)
#   6. Boolean fields (enableScaling, enableLogging, enableAlarm): use true/false
#   7. Delete these comment lines (starting with #) before uploading (optional)
#   8. Delete the example rows below and add your own data
#
# EXAMPLE ROWS (delete before importing your data):

${headers.join(',')}
TEMPERATURE_01,Boiler room temperature,Sensors,REAL,Demo PLC,40001,READ,°C,0,150,false,0,32767,0,100,true,1000,true
PRESSURE_01,Main line pressure,Sensors,REAL,Demo PLC,40002,READ,bar,0,10,false,0,32767,0,100,true,1000,false
MOTOR_01_RUN,Motor 1 running status,Motors,BOOL,Demo PLC,40003,READ_WRITE,,0,1,false,0,1,0,1,false,1000,false
SETPOINT_TEMP,Temperature setpoint,Setpoints,REAL,Demo PLC,40004,READ_WRITE,°C,20,120,false,0,32767,20,120,false,1000,false
COUNTER_PROD,Production counter,Counters,DINT,Demo PLC,40005,READ,pcs,0,999999,false,0,999999,0,999999,true,5000,false
`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tags_import_template.csv"');
  res.send(template);
};

// ═══════════════════════════════════════════════════════════
// ✅ T060: IMPORT TAGS FROM CSV
// POST /api/tags/import/csv   Body: { csvText, mode: 'create' | 'update' | 'upsert' }
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// ✅ T060: IMPORT TAGS FROM CSV (hardened)
// POST /api/tags/import/csv   Body: { csvText, mode: 'create' | 'update' | 'upsert' }
// ═══════════════════════════════════════════════════════════
const importTagsCSV = async (req, res) => {
  try {
    const { csvText, mode = 'create' } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'csvText is required',
      });
    }

    // Parse CSV
    const { headers, rows, rawHeaders } = parseCSV(csvText);

    // ─── DEBUG: log what we detected ───
    console.log(`📥 Tag import: detected ${headers.length} headers, ${rows.length} data rows`);
    console.log(`   Headers: [${headers.join(', ')}]`);

    if (headers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV appears to be empty or contains only comment lines. Please add data rows.',
      });
    }

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV has headers but no data rows. Please add at least one tag row.',
      });
    }

    // ─── Case-insensitive header validation ───
    const requiredHeaders = ['tagName', 'dataType'];
    const missingHeaders = [];

    for (const required of requiredHeaders) {
      if (!findHeader(headers, required)) {
        missingHeaders.push(required);
      }
    }

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          `CSV is missing required headers: ${missingHeaders.join(', ')}.\n\n` +
          `Detected headers: [${headers.join(', ')}].\n\n` +
          `Tip: The first non-comment line of your CSV must contain column names. ` +
          `Download a fresh template if unsure.`,
      });
    }

    // ─── Build case-insensitive row accessor ───
    // Since headers might be TagName vs tagName, we normalize row keys to lowercase
    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row).forEach((key) => {
        normalized[key.toLowerCase().trim()] = row[key];
      });
      return normalized;
    };

    // ─── Build PLC name → id lookup (case-insensitive) ───
    const allPLCs = await PLCConnection.find().select('_id name');
    const plcMap = new Map(allPLCs.map(p => [p.name.toLowerCase().trim(), p._id]));

    const results = {
      total: rows.length,
      created: [],
      updated: [],
      skipped: [],
      failed: [],
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const rowRaw = rows[i];
      const row = normalizeRow(rowRaw); // lowercase keys for lookup
      const rowNum = i + 2;

      try {
        // ─── Get values with case-insensitive lookup ───
        const tagName = (row.tagname || '').trim();
        const dataType = (row.datatype || '').trim();

        // Validate required fields
        if (!tagName) {
          results.failed.push({ row: rowNum, error: 'Missing tagName' });
          continue;
        }
        if (!dataType) {
          results.failed.push({ row: rowNum, tagName, error: 'Missing dataType' });
          continue;
        }

        const validDataTypes = ['BOOL', 'INT', 'DINT', 'REAL', 'STRING', 'WORD', 'DWORD', 'BYTE'];
        const upperDataType = dataType.toUpperCase();
        if (!validDataTypes.includes(upperDataType)) {
          results.failed.push({
            row: rowNum,
            tagName,
            error: `Invalid dataType '${dataType}'. Valid: ${validDataTypes.join(', ')}`,
          });
          continue;
        }

        const validAccessTypes = ['READ', 'WRITE', 'READ_WRITE'];
        const accessType = ((row.accesstype || 'READ_WRITE').trim() || 'READ_WRITE').toUpperCase();
        if (!validAccessTypes.includes(accessType)) {
          results.failed.push({
            row: rowNum,
            tagName,
            error: `Invalid accessType '${row.accesstype}'. Valid: ${validAccessTypes.join(', ')}`,
          });
          continue;
        }

        // Resolve PLC name to ID (if provided)
        let plcConnection = null;
        const plcName = (row.plcname || '').trim();
        if (plcName) {
          const plcId = plcMap.get(plcName.toLowerCase());
          if (!plcId) {
            results.failed.push({
              row: rowNum,
              tagName,
              error: `PLC "${plcName}" not found. Create the PLC first or leave plcName blank.`,
            });
            continue;
          }
          plcConnection = plcId;
        }

        // Parse boolean fields
        const parseBool = (v) => {
          if (v === true || v === false) return v;
          if (typeof v !== 'string') return false;
          const lower = v.trim().toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'yes';
        };

        // Parse number safely
        const parseNum = (v, fallback = 0) => {
          if (v === '' || v === null || v === undefined) return fallback;
          const n = Number(String(v).trim());
          return isNaN(n) ? fallback : n;
        };

        const tagData = {
          tagName: tagName.toUpperCase(),
          description: (row.description || '').trim(),
          group: (row.group || 'Default').trim() || 'Default',
          dataType: upperDataType,
          plcConnection,
          plcAddress: (row.plcaddress || '').trim(),
          accessType,
          unit: (row.unit || '').trim(),
          minValue: parseNum(row.minvalue, 0),
          maxValue: parseNum(row.maxvalue, 100),
          enableScaling: parseBool(row.enablescaling),
          rawMin: parseNum(row.rawmin, 0),
          rawMax: parseNum(row.rawmax, 32767),
          scaledMin: parseNum(row.scaledmin, 0),
          scaledMax: parseNum(row.scaledmax, 100),
          enableLogging: parseBool(row.enablelogging),
          loggingInterval: parseNum(row.logginginterval, 1000),
          enableAlarm: parseBool(row.enablealarm),
        };

        // Set default current value
        if (upperDataType === 'BOOL') tagData.currentValue = false;
        else if (upperDataType === 'STRING') tagData.currentValue = '';
        else tagData.currentValue = 0;

        // Check if tag exists
        const existing = await Tag.findOne({ tagName: tagData.tagName });

        if (existing) {
          if (mode === 'create') {
            results.skipped.push({
              row: rowNum,
              tagName: tagData.tagName,
              reason: 'Already exists (mode=create)',
            });
            continue;
          }
          Object.assign(existing, tagData);
          await existing.save();
          results.updated.push(tagData.tagName);
        } else {
          if (mode === 'update') {
            results.skipped.push({
              row: rowNum,
              tagName: tagData.tagName,
              reason: 'Does not exist (mode=update)',
            });
            continue;
          }
          await Tag.create(tagData);
          results.created.push(tagData.tagName);
        }
      } catch (err) {
        results.failed.push({
          row: rowNum,
          tagName: rowRaw.tagName || rowRaw.tagname || '(unknown)',
          error: err.message,
        });
      }
    }

    console.log(`✅ Tag import complete: ${results.created.length}c/${results.updated.length}u/${results.skipped.length}s/${results.failed.length}f`);

    res.json({
      success: true,
      message: `Import complete: ${results.created.length} created, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error('❌ Import Tags CSV Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import tags: ' + error.message,
      error: error.message,
    });
  }
};

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════
module.exports = {
  createTag,
  getAllTags,
  getTag,
  updateTag,
  deleteTag,
  writeTagValue,
  getTagGroups,
  bulkCreateTags,
  // ✅ Round 5
  exportTagsCSV,       // T061
  importTagsCSV,       // T060
  downloadTagTemplate, // Bonus
};