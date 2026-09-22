// ═══════════════════════════════════════════════════════════
// Tag Controller — Multi-Tenant Update
//
// ✅ All queries scoped by req.companyId
// ✅ All creates include companyId
// ✅ Plan limit enforcement (maxTags)
// ═══════════════════════════════════════════════════════════

const Tag = require('../models/Tag');
const PLCConnection = require('../models/PLCConnection');
const { broadcastConfigUpdate } = require('../services/edgeConfigBroadcaster');
// ─────────────────────────────────────────────────────────
// CSV UTILITIES (unchanged)
// ─────────────────────────────────────────────────────────
const csvEscape = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 2; }
      else if (ch === '"') { inQuotes = false; i++; }
      else { current += ch; i++; }
    } else {
      if (ch === '"' && current === '') { inQuotes = true; i++; }
      else if (ch === ',') { result.push(current); current = ''; i++; }
      else { current += ch; i++; }
    }
  }
  result.push(current);
  return result.map(s => s.trim());
};

const parseCSV = (csvText) => {
  if (!csvText || typeof csvText !== 'string') return { headers: [], rows: [], rawHeaders: [] };
  let cleaned = csvText
    .replace(/^\uFEFF/, '')
    .replace(/^\uFFFE/, '')
    .replace(/^\u00EF\u00BB\u00BF/, '');
  cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return false;
    if (trimmed.startsWith('#')) return false;
    return true;
  });
  if (lines.length === 0) return { headers: [], rows: [], rawHeaders: [] };
  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map((h) => h.trim());
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

const findHeader = (headers, target) => {
  const lower = target.toLowerCase();
  return headers.find(h => h.toLowerCase() === lower);
};

// ─── Helper: Check plan limits ───
const checkTagLimit = async (req) => {
  const currentCount = await Tag.countDocuments({ companyId: req.companyId });
  const maxTags = req.company?.limits?.maxTags || 999999;
  if (currentCount >= maxTags) {
    return {
      exceeded: true,
      current: currentCount,
      max: maxTags,
      message: `Plan limit reached: ${currentCount}/${maxTags} tags. Upgrade your plan to add more.`,
    };
  }
  return { exceeded: false };
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
      return res.status(400).json({ success: false, message: 'Tag name and data type are required' });
    }

    // ✅ Plan limit check
    const limitCheck = await checkTagLimit(req);
    if (limitCheck.exceeded) {
      return res.status(403).json({ success: false, message: limitCheck.message, code: 'PLAN_LIMIT_EXCEEDED' });
    }

    // ✅ Uniqueness check SCOPED to company
    const exists = await Tag.findOne({ companyId: req.companyId, tagName: tagName.toUpperCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Tag with this name already exists in this workspace' });
    }

    // ✅ PLC ownership check (can't reference another company's PLC)
    if (plcConnection) {
      const plcExists = await PLCConnection.findOne({ _id: plcConnection, companyId: req.companyId });
      if (!plcExists) {
        return res.status(404).json({ success: false, message: 'PLC not found in this workspace' });
      }
    }

    let defaultValue = 0;
    if (dataType === 'BOOL') defaultValue = false;
    if (dataType === 'STRING') defaultValue = '';

    const tag = await Tag.create({
      companyId: req.companyId, // ✅ MULTI-TENANT
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

    // Notify Edge Gateway to hot-reload new tags
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

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
// GET ALL TAGS (scoped)
// ═══════════════════════════════════════════════════════════
const getAllTags = async (req, res) => {
  try {
    const { group, dataType, search, plcId } = req.query;

    const filter = { companyId: req.companyId }; // ✅ MULTI-TENANT
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

    res.json({ success: true, count: tags.length, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET SINGLE TAG (scoped)
// ═══════════════════════════════════════════════════════════
const getTag = async (req, res) => {
  try {
    const tag = await Tag.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('plcConnection', 'name protocol ipAddress');
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found in this workspace' });
    res.json({ success: true, data: tag });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE TAG (scoped)
// ═══════════════════════════════════════════════════════════
const updateTag = async (req, res) => {
  try {
    delete req.body.companyId; // Prevent tenant escape
    if (req.body.tagName) req.body.tagName = req.body.tagName.toUpperCase();

    const tag = await Tag.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found in this workspace' });

    // Notify Edge Gateway to hot-reload new tags
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: 'Tag updated successfully', data: tag });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// DELETE TAG (scoped)
// ═══════════════════════════════════════════════════════════
const deleteTag = async (req, res) => {
  try {
    const tag = await Tag.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!tag) return res.status(404).json({ success: false, message: 'Tag not found in this workspace' });

    // Notify Edge Gateway to hot-reload new tags
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// WRITE VALUE TO TAG (scoped)
// ═══════════════════════════════════════════════════════════
const writeTagValue = async (req, res) => {
  try {
    const { tagName, value } = req.body;

    if (!tagName || value === undefined) {
      return res.status(400).json({ success: false, message: 'Tag name and value are required' });
    }

    // ✅ Scoped lookup
    const tag = await Tag.findOne({ companyId: req.companyId, tagName: tagName.toUpperCase() })
      .populate('plcConnection');
    if (!tag) {
      return res.status(404).json({ success: false, message: `Tag "${tagName}" not found in this workspace` });
    }

    if (tag.accessType === 'READ') {
      return res.status(403).json({ success: false, message: 'Tag is read-only' });
    }

    // ✅ Role check — operators/viewers can write to tags
    // But viewers can only read — block them
    if (req.user.role === 'viewer') {
      return res.status(403).json({ success: false, message: 'Viewers cannot write to tags' });
    }

    let normalizedValue = value;
    if (tag.dataType === 'BOOL') {
      normalizedValue = typeof value === 'string' ? value === 'true' || value === '1' : Boolean(value);
    } else if (['INT', 'DINT', 'REAL', 'WORD', 'DWORD', 'BYTE'].includes(tag.dataType)) {
      normalizedValue = Number(value);
      if (isNaN(normalizedValue)) {
        return res.status(400).json({
          success: false,
          message: `Value "${value}" is not a valid number for ${tag.dataType}`,
        });
      }
    }

    console.log(`📝 Write [${req.companySlug}] ${req.user.username}: ${tag.tagName} = ${normalizedValue}`);

    if (tag.plcConnection && tag.plcAddress) {
      try {
        const plcManager = require('../services/plcManager');
        await plcManager.writeTag(tag, normalizedValue);
      } catch (plcErr) {
        return res.status(500).json({ success: false, message: `PLC write failed: ${plcErr.message}` });
      }
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
        companyId: tag.companyId, // ✅ Include so runtime can filter (future)
      }]);
    }

    res.json({
      success: true,
      message: 'Tag value written successfully',
      data: { tagName: tag.tagName, value: tag.currentValue, timestamp: tag.lastUpdated },
    });
  } catch (error) {
    console.error('❌ writeTagValue error:', error.message);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET TAG GROUPS (scoped)
// ═══════════════════════════════════════════════════════════
const getTagGroups = async (req, res) => {
  try {
    const groups = await Tag.distinct('group', { companyId: req.companyId });

    const groupsWithCount = await Promise.all(
      groups.map(async (group) => {
        const count = await Tag.countDocuments({ companyId: req.companyId, group });
        return { name: group, count };
      })
    );

    res.json({ success: true, count: groups.length, data: groupsWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// BULK CREATE TAGS (scoped)
// ═══════════════════════════════════════════════════════════
const bulkCreateTags = async (req, res) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide array of tags' });
    }

    // ✅ Plan limit check
    const currentCount = await Tag.countDocuments({ companyId: req.companyId });
    const maxTags = req.company?.limits?.maxTags || 999999;
    const slotsRemaining = Math.max(0, maxTags - currentCount);

    if (tags.length > slotsRemaining) {
      return res.status(403).json({
        success: false,
        message: `Cannot create ${tags.length} tags. Only ${slotsRemaining} slots remaining (limit: ${maxTags}).`,
        code: 'PLAN_LIMIT_EXCEEDED',
      });
    }

    const results = { created: [], failed: [] };

    for (const tagData of tags) {
      try {
        if (tagData.tagName) tagData.tagName = tagData.tagName.toUpperCase();
        const tag = await Tag.create({ ...tagData, companyId: req.companyId });
        results.created.push(tag.tagName);
      } catch (error) {
        results.failed.push({ tagName: tagData.tagName, error: error.message });
      }
    }

    // Notify Edge Gateway to hot-reload new tags
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

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
// EXPORT TAGS AS CSV (scoped)
// ═══════════════════════════════════════════════════════════
const exportTagsCSV = async (req, res) => {
  try {
    const { group, dataType, plcId } = req.query;

    const filter = { companyId: req.companyId, isSimulationTag: { $ne: true } };
    if (group) filter.group = group;
    if (dataType) filter.dataType = dataType;
    if (plcId) filter.plcConnection = plcId;

    const tags = await Tag.find(filter).populate('plcConnection', 'name').sort({ tagName: 1 });

    const headers = [
      'tagName', 'description', 'group', 'dataType', 'plcName', 'plcAddress',
      'accessType', 'unit', 'minValue', 'maxValue',
      'enableScaling', 'rawMin', 'rawMax', 'scaledMin', 'scaledMax',
      'enableLogging', 'loggingInterval', 'enableAlarm',
    ];

    let csv = '';
    csv += `# OnlineSCADA Tag Export\n`;
    csv += `# Workspace: ${req.company?.slug || 'unknown'}\n`;
    csv += `# Generated: ${new Date().toISOString()}\n`;
    csv += `# Total Tags: ${tags.length}\n`;
    if (group) csv += `# Group Filter: ${group}\n`;
    if (dataType) csv += `# DataType Filter: ${dataType}\n`;
    if (plcId) csv += `# PLC Filter: ${plcId}\n`;
    csv += `# Note: Lines starting with # are ignored during import.\n`;
    csv += `#\n\n`;
    csv += headers.join(',') + '\n';

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
// DOWNLOAD CSV TEMPLATE (unchanged — template is static)
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
#   5. plcName should match an existing PLC name in YOUR workspace
#   6. Boolean fields (enableScaling, enableLogging, enableAlarm): use true/false
#   7. Delete comment lines (starting with #) before uploading (optional)
#   8. Delete example rows below and add your own data
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
// IMPORT TAGS FROM CSV (scoped + plan limit)
// ═══════════════════════════════════════════════════════════
const importTagsCSV = async (req, res) => {
  try {
    const { csvText, mode = 'create' } = req.body;

    if (!csvText || typeof csvText !== 'string') {
      return res.status(400).json({ success: false, message: 'csvText is required' });
    }

    const { headers, rows } = parseCSV(csvText);

    console.log(`📥 Tag import [${req.companySlug}]: ${headers.length} headers, ${rows.length} rows`);

    if (headers.length === 0) return res.status(400).json({ success: false, message: 'CSV appears to be empty' });
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'CSV has no data rows' });

    const requiredHeaders = ['tagName', 'dataType'];
    const missingHeaders = requiredHeaders.filter(h => !findHeader(headers, h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `CSV is missing required headers: ${missingHeaders.join(', ')}. Detected: [${headers.join(', ')}]`,
      });
    }

    // ✅ Plan limit check
    const currentCount = await Tag.countDocuments({ companyId: req.companyId });
    const maxTags = req.company?.limits?.maxTags || 999999;
    const slotsRemaining = Math.max(0, maxTags - currentCount);

    const normalizeRow = (row) => {
      const normalized = {};
      Object.keys(row).forEach((key) => { normalized[key.toLowerCase().trim()] = row[key]; });
      return normalized;
    };

    // ✅ Build PLC name → id lookup SCOPED to company
    const allPLCs = await PLCConnection.find({ companyId: req.companyId }).select('_id name');
    const plcMap = new Map(allPLCs.map(p => [p.name.toLowerCase().trim(), p._id]));

    const results = { total: rows.length, created: [], updated: [], skipped: [], failed: [] };
    let createdCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowRaw = rows[i];
      const row = normalizeRow(rowRaw);
      const rowNum = i + 2;

      try {
        const tagName = (row.tagname || '').trim();
        const dataType = (row.datatype || '').trim();

        if (!tagName) { results.failed.push({ row: rowNum, error: 'Missing tagName' }); continue; }
        if (!dataType) { results.failed.push({ row: rowNum, tagName, error: 'Missing dataType' }); continue; }

        const validDataTypes = ['BOOL', 'INT', 'DINT', 'REAL', 'STRING', 'WORD', 'DWORD', 'BYTE'];
        const upperDataType = dataType.toUpperCase();
        if (!validDataTypes.includes(upperDataType)) {
          results.failed.push({ row: rowNum, tagName, error: `Invalid dataType '${dataType}'` });
          continue;
        }

        const validAccessTypes = ['READ', 'WRITE', 'READ_WRITE'];
        const accessType = ((row.accesstype || 'READ_WRITE').trim() || 'READ_WRITE').toUpperCase();
        if (!validAccessTypes.includes(accessType)) {
          results.failed.push({ row: rowNum, tagName, error: `Invalid accessType '${row.accesstype}'` });
          continue;
        }

        let plcConnection = null;
        const plcName = (row.plcname || '').trim();
        if (plcName) {
          const plcId = plcMap.get(plcName.toLowerCase());
          if (!plcId) {
            results.failed.push({ row: rowNum, tagName, error: `PLC "${plcName}" not found in this workspace` });
            continue;
          }
          plcConnection = plcId;
        }

        const parseBool = (v) => {
          if (v === true || v === false) return v;
          if (typeof v !== 'string') return false;
          const lower = v.trim().toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'yes';
        };

        const parseNum = (v, fallback = 0) => {
          if (v === '' || v === null || v === undefined) return fallback;
          const n = Number(String(v).trim());
          return isNaN(n) ? fallback : n;
        };

        const tagData = {
          companyId: req.companyId, // ✅ MULTI-TENANT
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

        if (upperDataType === 'BOOL') tagData.currentValue = false;
        else if (upperDataType === 'STRING') tagData.currentValue = '';
        else tagData.currentValue = 0;

        // ✅ Scoped uniqueness check
        const existing = await Tag.findOne({ companyId: req.companyId, tagName: tagData.tagName });

        if (existing) {
          if (mode === 'create') {
            results.skipped.push({ row: rowNum, tagName: tagData.tagName, reason: 'Already exists' });
            continue;
          }
          delete tagData.companyId;
          Object.assign(existing, tagData);
          await existing.save();
          results.updated.push(tagData.tagName);
        } else {
          if (mode === 'update') {
            results.skipped.push({ row: rowNum, tagName: tagData.tagName, reason: 'Does not exist' });
            continue;
          }
          // ✅ Plan limit check
          if (createdCount >= slotsRemaining) {
            results.failed.push({
              row: rowNum,
              tagName: tagData.tagName,
              error: `Plan limit reached (${maxTags} tags)`,
            });
            continue;
          }
          await Tag.create(tagData);
          results.created.push(tagData.tagName);
          createdCount++;
        }
      } catch (err) {
        results.failed.push({
          row: rowNum,
          tagName: rowRaw.tagName || rowRaw.tagname || '(unknown)',
          error: err.message,
        });
      }
    }

    console.log(`✅ Tag import complete [${req.companySlug}]: ${results.created.length}c/${results.updated.length}u/${results.skipped.length}s/${results.failed.length}f`);

    // Notify Edge Gateway to hot-reload new tags
    try {
      const io = req.app.get('io');
      await broadcastConfigUpdate(io, req.companyId);
    } catch (e) {}

    res.json({
      success: true,
      message: `Import complete: ${results.created.length} created, ${results.updated.length} updated, ${results.skipped.length} skipped, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error('❌ Import Tags CSV Error:', error);
    res.status(500).json({ success: false, message: 'Failed to import tags: ' + error.message, error: error.message });
  }
};

module.exports = {
  createTag,
  getAllTags,
  getTag,
  updateTag,
  deleteTag,
  writeTagValue,
  getTagGroups,
  bulkCreateTags,
  exportTagsCSV,
  importTagsCSV,
  downloadTagTemplate,
};