// ═══════════════════════════════════════════════════════════
// Binding Utilities — Sprint C
// Core engine for per-property dynamic tag bindings
// Uses element.dynamicBindings map
// ═══════════════════════════════════════════════════════════

/**
 * Binding Modes:
 *   - 'direct'      : Pass tag value through (with optional format)
 *   - 'boolMap'     : true → trueValue, false → falseValue
 *   - 'rangeMap'    : [{ min, max, value }, ...]
 *   - 'expression'  : Math expression (STUB — Sprint D)
 *
 * Element Schema:
 *   element.dynamicBindings = {
 *     [propertyKey]: {
 *       mode, tag, ...modeSpecificConfig
 *     }
 *   }
 */

// ─────────────────────────────────────────────────────────────
// TAG TYPE DETECTION
// ─────────────────────────────────────────────────────────────

export const getTagType = (tagName, tags = []) => {
  if (!tagName || !Array.isArray(tags)) return 'UNKNOWN';
  const tag = tags.find((t) => t.tagName === tagName);
  return tag?.dataType || 'UNKNOWN';
};

export const isBoolTag = (tagName, tags = []) => {
  return getTagType(tagName, tags) === 'BOOL';
};

export const isNumericTag = (tagName, tags = []) => {
  const type = getTagType(tagName, tags);
  return ['INT', 'DINT', 'REAL', 'WORD', 'DWORD'].includes(type);
};

// ─────────────────────────────────────────────────────────────
// VALUE FORMATTING
// ─────────────────────────────────────────────────────────────

export const formatValue = (value, format = {}) => {
  if (value === null || value === undefined) return '';

  const { decimals, prefix = '', suffix = '', thousandSep = false } = format;

  let formatted = value;

  if (typeof value === 'number' || (!isNaN(parseFloat(value)) && isFinite(value))) {
    const num = Number(value);

    if (decimals !== undefined && decimals !== null) {
      formatted = num.toFixed(decimals);
    } else {
      formatted = num.toString();
    }

    if (thousandSep) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }
  } else if (typeof value === 'boolean') {
    formatted = value ? 'TRUE' : 'FALSE';
  } else {
    formatted = String(value);
  }

  return `${prefix}${formatted}${suffix}`;
};

// ─────────────────────────────────────────────────────────────
// BINDING EVALUATION
// ─────────────────────────────────────────────────────────────

export const evaluateBinding = (binding, liveValues = {}, tags = []) => {
  if (!binding || typeof binding !== 'object') return undefined;
  if (!binding.tag) return undefined;

  const rawValue = liveValues[binding.tag];

  if (rawValue === null || rawValue === undefined) return undefined;

  const mode = binding.mode || 'direct';

  switch (mode) {
    // ─────────────────────────────────────────────────────────
    // DIRECT MODE
    // ─────────────────────────────────────────────────────────
    case 'direct': {
      if (binding.format) {
        return formatValue(rawValue, binding.format);
      }
      return rawValue;
    }

    // ─────────────────────────────────────────────────────────
    // BOOLEAN MAP
    // ─────────────────────────────────────────────────────────
    case 'boolMap': {
      let boolVal;
      if (typeof rawValue === 'boolean') {
        boolVal = rawValue;
      } else if (typeof rawValue === 'number') {
        boolVal = rawValue !== 0;
      } else if (typeof rawValue === 'string') {
        boolVal = rawValue.toLowerCase() === 'true' || rawValue === '1';
      } else {
        boolVal = !!rawValue;
      }

      return boolVal
        ? (binding.trueValue !== undefined ? binding.trueValue : true)
        : (binding.falseValue !== undefined ? binding.falseValue : false);
    }

    // ─────────────────────────────────────────────────────────
    // RANGE MAP
    // ─────────────────────────────────────────────────────────
    case 'rangeMap': {
      const num = Number(rawValue);
      if (isNaN(num)) return binding.defaultValue;

      const ranges = binding.ranges || [];
      for (const range of ranges) {
        const min = range.min !== undefined ? Number(range.min) : -Infinity;
        const max = range.max !== undefined ? Number(range.max) : Infinity;
        if (num >= min && num <= max) {
          return range.value;
        }
      }
      return binding.defaultValue !== undefined ? binding.defaultValue : undefined;
    }

    // ─────────────────────────────────────────────────────────
    // EXPRESSION MODE — STUB (Sprint D)
    // ─────────────────────────────────────────────────────────
    case 'expression': {
      console.warn('[Sprint C] Expression mode is stubbed — returning raw tag value');
      return rawValue;
    }

    default:
      return rawValue;
  }
};

// ─────────────────────────────────────────────────────────────
// ELEMENT-LEVEL BINDING RESOLUTION
// ─────────────────────────────────────────────────────────────

/**
 * Resolve ALL dynamicBindings on an element
 * Returns new element with bound properties replaced by live values
 */
export const resolveElementBindings = (element, liveValues = {}, tags = []) => {
  if (!element) return element;

  // Apply legacy migration first (backward compat)
  const migrated = migrateLegacyBindings(element);

  const dynamicBindings = migrated.dynamicBindings;
  if (!dynamicBindings || typeof dynamicBindings !== 'object' || Object.keys(dynamicBindings).length === 0) {
    return migrated;
  }

  const resolved = { ...migrated };

  for (const [propKey, binding] of Object.entries(dynamicBindings)) {
    const value = evaluateBinding(binding, liveValues, tags);
    if (value !== undefined) {
      resolved[propKey] = value;
    }
  }

  return resolved;
};

// ─────────────────────────────────────────────────────────────
// BINDING MANAGEMENT (Add / Remove / Check)
// ─────────────────────────────────────────────────────────────

export const isPropertyBound = (element, propertyKey) => {
  if (!element || !element.dynamicBindings) return false;
  return !!element.dynamicBindings[propertyKey];
};

export const getBinding = (element, propertyKey) => {
  if (!element || !element.dynamicBindings) return null;
  return element.dynamicBindings[propertyKey] || null;
};

export const setBinding = (element, propertyKey, binding) => {
  if (!element || !propertyKey) return element;
  const newBindings = { ...(element.dynamicBindings || {}), [propertyKey]: binding };
  return { ...element, dynamicBindings: newBindings };
};

export const removeBinding = (element, propertyKey) => {
  if (!element || !element.dynamicBindings) return element;
  const newBindings = { ...element.dynamicBindings };
  delete newBindings[propertyKey];
  return { ...element, dynamicBindings: newBindings };
};

export const getBoundProperties = (element) => {
  if (!element || !element.dynamicBindings) return [];
  return Object.keys(element.dynamicBindings);
};

// ─────────────────────────────────────────────────────────────
// LEGACY MIGRATION
// ─────────────────────────────────────────────────────────────

export const migrateLegacyBindings = (element) => {
  if (!element) return element;

  if (element.dynamicBindings && Object.keys(element.dynamicBindings).length > 0) {
    return element;
  }

  if (!element.boundTag) return element;

  const migrated = { ...element };
  const newBindings = {};

  const anim = element.animation || {};
  const tagName = element.boundTag;

  if (!anim.enabled) {
    if (['text', 'textDisplay', 'numericDisplay', 'ioField'].includes(element.type)) {
      newBindings.text = { mode: 'direct', tag: tagName };
    } else {
      return element;
    }
  }

  else if (anim.type === 'color') {
    if (anim.minValue !== undefined && anim.maxValue !== undefined) {
      newBindings.fill = {
        mode: 'rangeMap',
        tag: tagName,
        ranges: [
          { min: -Infinity, max: anim.minValue, value: anim.minColor || '#ef4444' },
          { min: anim.minValue, max: anim.maxValue, value: anim.maxColor || '#10b981' },
          { min: anim.maxValue, max: Infinity, value: anim.maxColor || '#10b981' },
        ],
        defaultValue: anim.minColor || '#ef4444',
      };
    } else {
      newBindings.fill = {
        mode: 'boolMap',
        tag: tagName,
        trueValue: anim.maxColor || '#10b981',
        falseValue: anim.minColor || '#ef4444',
      };
    }
  }

  else if (anim.type === 'visibility') {
    newBindings.isVisible = {
      mode: 'boolMap',
      tag: tagName,
      trueValue: true,
      falseValue: false,
    };
  }

  // NOTE: 'flash' and 'fill' animations NOT migrated
  // (flash is time-based, fill is tank-specific — renderer handles them)

  if (Object.keys(newBindings).length > 0) {
    migrated.dynamicBindings = newBindings;
    migrated._legacyMigrated = true;
  }

  return migrated;
};

// ─────────────────────────────────────────────────────────────
// UTILITY — Suggest binding modes for property + tag type
// ─────────────────────────────────────────────────────────────

export const getSuggestedModes = (propertyType, tagType) => {
  const isBool = tagType === 'BOOL';
  const isNumeric = ['INT', 'DINT', 'REAL', 'WORD', 'DWORD'].includes(tagType);

  if (propertyType === 'color') {
    if (isBool) return ['boolMap'];
    if (isNumeric) return ['rangeMap', 'boolMap'];
    return ['boolMap', 'rangeMap'];
  }

  if (propertyType === 'number') {
    return ['direct', 'rangeMap', 'expression'];
  }

  if (propertyType === 'text') {
    return ['direct', 'boolMap', 'rangeMap'];
  }

  if (propertyType === 'boolean') {
    return ['direct', 'boolMap', 'rangeMap'];
  }

  if (propertyType === 'select') {
    return ['boolMap', 'rangeMap', 'direct'];
  }

  return ['direct', 'boolMap', 'rangeMap'];
};

// ─────────────────────────────────────────────────────────────
// DEFAULT BINDING BUILDER
// ─────────────────────────────────────────────────────────────

export const createDefaultBinding = (propertyType, tagName, tagType) => {
  const isBool = tagType === 'BOOL';

  if (propertyType === 'color') {
    if (isBool) {
      return {
        mode: 'boolMap',
        tag: tagName,
        trueValue: '#10b981',
        falseValue: '#ef4444',
      };
    }
    return {
      mode: 'rangeMap',
      tag: tagName,
      ranges: [
        { min: 0, max: 50, value: '#10b981' },
        { min: 50, max: 80, value: '#f59e0b' },
        { min: 80, max: 999999, value: '#ef4444' },
      ],
      defaultValue: '#10b981',
    };
  }

  if (propertyType === 'boolean') {
    return { mode: 'direct', tag: tagName };
  }

  if (propertyType === 'text') {
    return {
      mode: 'direct',
      tag: tagName,
      format: { decimals: 2, prefix: '', suffix: '' },
    };
  }

  return { mode: 'direct', tag: tagName };
};

// ═══════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════