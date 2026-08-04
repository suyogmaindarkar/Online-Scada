// ═══════════════════════════════════════════════════════════
// Direct Connection Utils — Sprint D2
// Auto-copy value from source to target on trigger events
// ═══════════════════════════════════════════════════════════

import { tagAPI } from '../services/api';

/**
 * Direct Connection Schema:
 *   {
 *     id: 'dc_xxxxx',
 *     name: 'Motor Sync',
 *     enabled: true,
 *
 *     source: {
 *       type: 'tag' | 'static',
 *       tag: 'MOTOR1',    // if type='tag'
 *       value: 'true',    // if type='static' (raw string, will be coerced)
 *     },
 *
 *     target: {
 *       type: 'tag',
 *       tag: 'MOTOR1_BACKUP',
 *     },
 *
 *     trigger: 'onChange' | 'onLoad',
 *   }
 */

// ─────────────────────────────────────────────────────────────
// VALUE COERCION (same rules as eventUtils)
// ─────────────────────────────────────────────────────────────

const coerceValue = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return value;

  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;

  if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) {
    return parseFloat(trimmed);
  }

  return value;
};

// ─────────────────────────────────────────────────────────────
// GET SOURCE VALUE
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the source value from a Direct Connection
 * Returns undefined if source can't be resolved yet
 */
const getSourceValue = (connection, liveValues = {}) => {
  const src = connection.source;
  if (!src) return undefined;

  if (src.type === 'static') {
    return coerceValue(src.value);
  }

  if (src.type === 'tag') {
    if (!src.tag) return undefined;
    return liveValues[src.tag];
  }

  return undefined;
};

// ─────────────────────────────────────────────────────────────
// EXECUTE SINGLE CONNECTION
// ─────────────────────────────────────────────────────────────

/**
 * Execute one Direct Connection — writes source value to target
 * @returns { success, wrote, error }
 */
export const executeDirectConnection = async (connection, liveValues = {}) => {
  if (!connection || !connection.enabled) {
    return { success: true, skipped: true, reason: 'disabled' };
  }

  const target = connection.target;
  if (!target || target.type !== 'tag' || !target.tag) {
    return { success: false, error: 'Invalid target' };
  }

  const value = getSourceValue(connection, liveValues);
  if (value === undefined || value === null) {
    return { success: true, skipped: true, reason: 'no_source_value' };
  }

  try {
    await tagAPI.writeValue(target.tag, value);
    console.log(`🔗 DirectConnection [${connection.name || connection.id}]: ${target.tag} = ${value}`);
    return { success: true, wrote: { tag: target.tag, value } };
  } catch (err) {
    console.error(`❌ DirectConnection failed [${connection.name || connection.id}]:`, err.message);
    return { success: false, error: err.message };
  }
};

// ─────────────────────────────────────────────────────────────
// EXECUTE ALL — ON LOAD
// ─────────────────────────────────────────────────────────────

/**
 * Fire all onLoad connections (called once when screen loads)
 */
export const executeOnLoadConnections = async (connections = [], liveValues = {}) => {
  const onLoadConnections = connections.filter(
    (c) => c.enabled && c.trigger === 'onLoad'
  );

  const results = [];
  for (const conn of onLoadConnections) {
    const result = await executeDirectConnection(conn, liveValues);
    results.push({ id: conn.id, ...result });
  }
  return results;
};

// ─────────────────────────────────────────────────────────────
// EXECUTE ON TAG CHANGE
// ─────────────────────────────────────────────────────────────

/**
 * When tag values change, fire onChange connections whose source tag changed
 *
 * @param {Array} connections - All connections
 * @param {Object} liveValues - Current tag values
 * @param {Set|Array} changedTags - Tag names that just changed
 */
export const executeOnChangeConnections = async (
  connections = [],
  liveValues = {},
  changedTags = new Set()
) => {
  const changedSet = changedTags instanceof Set ? changedTags : new Set(changedTags);

  const relevantConnections = connections.filter((c) => {
    if (!c.enabled || c.trigger !== 'onChange') return false;
    if (c.source?.type !== 'tag') return false;
    return changedSet.has(c.source.tag);
  });

  const results = [];
  for (const conn of relevantConnections) {
    const result = await executeDirectConnection(conn, liveValues);
    results.push({ id: conn.id, ...result });
  }
  return results;
};

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Create a new empty Direct Connection with defaults
 */
export const createEmptyConnection = () => ({
  id: `dc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  name: '',
  enabled: true,
  source: { type: 'tag', tag: '', value: '' },
  target: { type: 'tag', tag: '' },
  trigger: 'onChange',
});

/**
 * Validate a connection — returns error message or null if valid
 */
export const validateConnection = (conn) => {
  if (!conn.target?.tag) return 'Target tag is required';
  if (conn.source?.type === 'tag' && !conn.source.tag) return 'Source tag is required';
  if (conn.source?.type === 'static' && (conn.source.value === '' || conn.source.value === undefined)) {
    return 'Static value is required';
  }
  return null;
};

// ═══════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════