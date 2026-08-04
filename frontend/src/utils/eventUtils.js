// ═══════════════════════════════════════════════════════════
// Event Execution Engine — Sprint D
// Executes multi-action events with backward compat
// ═══════════════════════════════════════════════════════════

import { tagAPI } from '../services/api';

/**
 * Event Schema:
 *   element.events = {
 *     onClick: [action1, action2, ...],     // Array (new format)
 *     onClick: { type, targetTag, value },  // Object (legacy, auto-converted)
 *     ...
 *   }
 *
 * Action Schema:
 *   {
 *     type: 'writeTag' | 'toggleTag' | 'incrementTag' | 'decrementTag' |
 *           'copyTag' | 'changeScreen' | 'showMessage' | 'confirm',
 *     ...typeSpecificFields,
 *
 *     // Optional common fields:
 *     confirmMessage: 'Are you sure?',
 *     condition: { tag, operator, value },
 *     delay: 500, // ms
 *   }
 *
 * Execution Context:
 *   {
 *     liveValues,   // { tagName: value }
 *     navigate,     // React Router navigate fn
 *     showToast,    // (message, type) => void
 *     showConfirm,  // ({ title, message, onConfirm }) => void
 *     currentElement,
 *     allElements,
 *     tags,
 *   }
 */

// ─────────────────────────────────────────────────────────────
// NORMALIZE — Convert legacy single-action to array format
// ─────────────────────────────────────────────────────────────

/**
 * Normalize any event value into an array of actions
 * Handles:
 *   - Array (already normalized)      → returned as-is
 *   - Object with `action` (legacy)   → converted to array [{ type: action, ... }]
 *   - Object with `type` (new)        → wrapped in array
 *   - null/undefined                  → empty array
 */
export const normalizeActions = (eventValue) => {
  if (!eventValue) return [];

  // Already an array
  if (Array.isArray(eventValue)) {
    return eventValue.map(normalizeAction).filter(Boolean);
  }

  // Single object
  if (typeof eventValue === 'object') {
    const normalized = normalizeAction(eventValue);
    return normalized ? [normalized] : [];
  }

  return [];
};

/**
 * Normalize a single action object
 * Handles legacy `action` field vs new `type` field
 */
const normalizeAction = (action) => {
  if (!action || typeof action !== 'object') return null;

  // Legacy: has `action` field but no `type` — convert
  if (!action.type && action.action) {
    return { ...action, type: action.action };
  }

  // Already normalized
  if (action.type) return action;

  return null;
};

// ─────────────────────────────────────────────────────────────
// CONDITION EVALUATION
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a condition against live values
 * Returns true if action should execute
 */
export const evaluateCondition = (condition, liveValues = {}) => {
  if (!condition) return true; // No condition = always execute
  if (!condition.tag) return true;

  const currentValue = liveValues[condition.tag];
  if (currentValue === undefined || currentValue === null) return false;

  const expected = condition.value;
  const op = condition.operator || '==';

  switch (op) {
    case '==': return currentValue == expected;
    case '!=': return currentValue != expected;
    case '>':  return Number(currentValue) > Number(expected);
    case '<':  return Number(currentValue) < Number(expected);
    case '>=': return Number(currentValue) >= Number(expected);
    case '<=': return Number(currentValue) <= Number(expected);
    default:   return true;
  }
};

// ─────────────────────────────────────────────────────────────
// VALUE COERCION
// ─────────────────────────────────────────────────────────────

/**
 * Convert user-input value to correct type
 * Handles: 'true'/'false' → bool, numbers → number, otherwise string
 */
const coerceValue = (value) => {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed === '') return value;

  // Boolean
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;

  // Number
  if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) {
    return parseFloat(trimmed);
  }

  return value;
};

// ─────────────────────────────────────────────────────────────
// SINGLE ACTION EXECUTION
// ─────────────────────────────────────────────────────────────

/**
 * Execute a single action
 * Returns { success: true } or { success: false, error }
 */
export const executeAction = async (action, context = {}) => {
  if (!action || !action.type) {
    return { success: false, error: 'Invalid action' };
  }

  const {
    liveValues = {},
    navigate,
    showToast,
    showConfirm,
  } = context;

  // ── Delay (if specified) ────────────────────────────────
  if (action.delay && action.delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, action.delay));
  }

  // ── Condition check ─────────────────────────────────────
  if (action.condition && !evaluateCondition(action.condition, liveValues)) {
    return { success: true, skipped: true, reason: 'condition_not_met' };
  }

  // ── Confirmation prompt ─────────────────────────────────
  if (action.confirmMessage) {
    const confirmed = await new Promise((resolve) => {
      if (showConfirm) {
        showConfirm({
          title: 'Confirm Action',
          message: action.confirmMessage,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      } else {
        resolve(window.confirm(action.confirmMessage));
      }
    });

    if (!confirmed) {
      return { success: true, skipped: true, reason: 'user_cancelled' };
    }
  }

  // ── Execute by type ─────────────────────────────────────
  try {
    switch (action.type) {
      case 'writeTag':
        return await executeWriteTag(action, context);

      case 'toggleTag':
        return await executeToggleTag(action, context);

      case 'incrementTag':
        return await executeIncrementTag(action, context, 1);

      case 'decrementTag':
        return await executeIncrementTag(action, context, -1);

      case 'copyTag':
        return await executeCopyTag(action, context);

      case 'changeScreen':
        return executeChangeScreen(action, context);

      case 'showMessage':
      case 'alert':
        return executeShowMessage(action, context);

      case 'showPopup':
      case 'closePopup':
        return executeShowPopup(action, context);

      // Stubs for future
      case 'runScript':
      case 'playSound':
        console.warn(`[Sprint D] Action "${action.type}" is stubbed`);
        if (showToast) showToast(`Action "${action.type}" not yet implemented`, 'warning');
        return { success: true, skipped: true };

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
};

// ─────────────────────────────────────────────────────────────
// ACTION IMPLEMENTATIONS
// ─────────────────────────────────────────────────────────────

const executeWriteTag = async (action, context) => {
  const { targetTag, value } = action;
  if (!targetTag) throw new Error('writeTag: targetTag is required');

  const coerced = coerceValue(value);
  await tagAPI.writeValue(targetTag, coerced);
  return { success: true, wrote: { tag: targetTag, value: coerced } };
};

const executeToggleTag = async (action, context) => {
  const { targetTag } = action;
  const { liveValues = {} } = context;
  if (!targetTag) throw new Error('toggleTag: targetTag is required');

  const currentValue = liveValues[targetTag];
  const newValue = !currentValue;
  await tagAPI.writeValue(targetTag, newValue);
  return { success: true, wrote: { tag: targetTag, value: newValue } };
};

const executeIncrementTag = async (action, context, sign = 1) => {
  const { targetTag, step = 1 } = action;
  const { liveValues = {} } = context;
  if (!targetTag) throw new Error(`${sign > 0 ? 'increment' : 'decrement'}Tag: targetTag is required`);

  const currentValue = Number(liveValues[targetTag]) || 0;
  const newValue = currentValue + sign * Number(step);
  await tagAPI.writeValue(targetTag, newValue);
  return { success: true, wrote: { tag: targetTag, value: newValue } };
};

const executeCopyTag = async (action, context) => {
  const { sourceTag, targetTag } = action;
  const { liveValues = {} } = context;
  if (!sourceTag || !targetTag) {
    throw new Error('copyTag: sourceTag and targetTag are required');
  }

  const value = liveValues[sourceTag];
  if (value === undefined) {
    throw new Error(`copyTag: source tag "${sourceTag}" has no value`);
  }

  await tagAPI.writeValue(targetTag, value);
  return { success: true, wrote: { from: sourceTag, to: targetTag, value } };
};

const executeChangeScreen = (action, context) => {
  const { screenName } = action;
  const { navigate, showToast } = context;
  if (!screenName) throw new Error('changeScreen: screenName is required');

  // For now, use navigate — later can be enhanced to load specific screen by name
  console.log(`[Sprint D] changeScreen to: ${screenName}`);
  if (showToast) showToast(`Navigate to: ${screenName}`, 'info');
  // TODO: Actual screen switching in Runtime page (Sprint D2/D5)
  return { success: true };
};

const executeShowMessage = (action, context) => {
  const { text, message, style = 'info' } = action;
  const { showToast } = context;
  const msg = text || message || 'Message';

  if (showToast) {
    showToast(msg, style);
  } else {
    alert(msg);
  }
  return { success: true };
};

const executeShowPopup = (action, context) => {
  console.log('[Sprint D] Popup actions are stubbed — full impl in Sprint E');
  return { success: true, skipped: true };
};

// ─────────────────────────────────────────────────────────────
// MULTI-ACTION EVENT EXECUTION (Sequential + Stop-on-error)
// ─────────────────────────────────────────────────────────────

/**
 * Execute all actions for an event, one after another
 * Stops immediately if any action fails
 *
 * @param {Array|Object} eventValue - Event definition (array or single obj)
 * @param {Object} context - Execution context
 * @returns {Promise<{success, results, error?}>}
 */
export const executeEvent = async (eventValue, context = {}) => {
  const actions = normalizeActions(eventValue);

  if (actions.length === 0) {
    return { success: true, results: [], skipped: true };
  }

  const results = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const result = await executeAction(action, context);
    results.push({ actionIndex: i, actionType: action.type, ...result });

    // Stop on error
    if (!result.success) {
      console.error(`❌ Event execution stopped at action ${i} (${action.type}):`, result.error);
      if (context.showToast) {
        context.showToast(`Action failed: ${result.error}`, 'error');
      }
      return {
        success: false,
        results,
        error: result.error,
        failedAt: i,
      };
    }
  }

  return { success: true, results };
};

// ─────────────────────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────────────────────

/**
 * Get all supported action types
 */
export const getSupportedActionTypes = () => [
  'writeTag',
  'toggleTag',
  'incrementTag',
  'decrementTag',
  'copyTag',
  'changeScreen',
  'showMessage',
  'alert',
];

/**
 * Get all supported event names
 */
export const getSupportedEvents = () => [
  'onClick',
  'onDoubleClick',
  'onPressLeft',
  'onReleaseLeft',
  'onPressRight',
  'onReleaseRight',
  'onMouseEnter',
  'onMouseLeave',
  'onKeyDown',
  'onKeyUp',
  'onFocus',
  'onBlur',
  'onValueChange',
  'onLoad',
];

// ═══════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════