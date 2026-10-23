// ═══════════════════════════════════════════════════════════
// Interactive Element Utils — Sprint D4
// Helpers for CheckBox, RadioButton, ComboBox, ListBox, IoField
// ═══════════════════════════════════════════════════════════

import { tagAPI } from '../services/api';
import socketService from '../services/socket';

// ─────────────────────────────────────────────────────────────
// VALUE COERCION (consistent across all interactive elements)
// ─────────────────────────────────────────────────────────────

export const coerceValue = (value, targetType) => {
  if (value === null || value === undefined) return value;

  const str = String(value).trim();

  // Explicit type hint (from tag dataType)
  if (targetType === 'BOOL') {
    return str.toLowerCase() === 'true' || str === '1';
  }
  if (['INT', 'DINT', 'WORD', 'DWORD'].includes(targetType)) {
    return parseInt(str) || 0;
  }
  if (targetType === 'REAL') {
    return parseFloat(str) || 0;
  }
  if (targetType === 'STRING') {
    return str;
  }

  // Auto-detect
  if (str === '') return '';
  if (str.toLowerCase() === 'true') return true;
  if (str.toLowerCase() === 'false') return false;
  if (!isNaN(parseFloat(str)) && isFinite(str)) return parseFloat(str);
  return str;
};

// ─────────────────────────────────────────────────────────────
// OPTIONS ARRAY MANAGEMENT
// Options stored as: [{ label: 'Auto', value: 1 }, ...]
// ─────────────────────────────────────────────────────────────

export const parseOptions = (options) => {
  if (Array.isArray(options)) {
    return options.filter((o) => o && typeof o === 'object');
  }
  return [];
};

export const stringifyOptionsForDisplay = (options) => {
  const parsed = parseOptions(options);
  if (parsed.length === 0) return '';
  return parsed.map((o) => `${o.label}=${o.value}`).join(', ');
};

// ─────────────────────────────────────────────────────────────
// WRITE HELPER — With optional confirmation
// ─────────────────────────────────────────────────────────────

export const writeInteractiveValue = async ({
  targetTag,
  value,
  tags = [],
  requireConfirm = false,
  confirmMessage,
  showToast,
}) => {
  if (!targetTag) {
    console.warn('[Interactive] No target tag specified');
    return { success: false, error: 'No target tag' };
  }

  // Find tag data type for coercion
  const tagInfo = tags.find((t) => t.tagName === targetTag);
  const targetType = tagInfo?.dataType;
  const coerced = coerceValue(value, targetType);

  // Confirmation
  if (requireConfirm) {
    const msg = confirmMessage || `Write "${coerced}" to ${targetTag}?`;
    if (!window.confirm(msg)) {
      return { success: true, skipped: true };
    }
  }

  try {
    await tagAPI.writeValue(targetTag, coerced);
    socketService.emit('writeTag', { tagName: targetTag, value: coerced });
    console.log(`✓ Interactive write: ${targetTag} = ${coerced}`);
    if (showToast) showToast(`${targetTag} = ${coerced}`, 'success');
    return { success: true, wrote: { tag: targetTag, value: coerced } };
  } catch (err) {
    console.error(`✗ Interactive write failed: ${targetTag}`, err);
    if (showToast) showToast(`Write failed: ${err.message}`, 'error');
    return { success: false, error: err.message };
  }
};

// Single runtime write path: API, socket update, and user feedback are kept in
// the same success/error boundary so widgets cannot report a false success or
// emit a value that the API rejected.
export const writeRuntimeValue = async (options = {}) => (
  writeInteractiveValue(options)
);

// ─────────────────────────────────────────────────────────────
// COMPARE VALUES (for RadioButton "isSelected" check)
// Handles type coercion for comparison
// ─────────────────────────────────────────────────────────────

export const valuesEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;

  // Compare as strings (handles "1" == 1, "true" == true, etc.)
  return String(a).toLowerCase() === String(b).toLowerCase();
};

// ═══════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════
