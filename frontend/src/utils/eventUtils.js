// ═══════════════════════════════════════════════════════════
// Event Execution Engine — UPDATED with popup support
// ═══════════════════════════════════════════════════════════

import { tagAPI } from '../services/api';

export const normalizeActions = (eventValue) => {
  if (!eventValue) return [];
  if (Array.isArray(eventValue)) return eventValue.map(normalizeAction).filter(Boolean);
  if (typeof eventValue === 'object') {
    const normalized = normalizeAction(eventValue);
    return normalized ? [normalized] : [];
  }
  return [];
};

const normalizeAction = (action) => {
  if (!action || typeof action !== 'object') return null;
  if (!action.type && action.action) return { ...action, type: action.action };
  if (action.type) return action;
  return null;
};

export const evaluateCondition = (condition, liveValues = {}) => {
  if (!condition) return true;
  if (!condition.tag) return true;
  const currentValue = liveValues[condition.tag];
  if (currentValue === undefined || currentValue === null) return false;
  const expected = condition.value;
  const op = condition.operator || '==';
  switch (op) {
    case '==': return currentValue == expected;   // eslint-disable-line eqeqeq
    case '!=': return currentValue != expected;   // eslint-disable-line eqeqeq
    case '>':  return Number(currentValue) > Number(expected);
    case '<':  return Number(currentValue) < Number(expected);
    case '>=': return Number(currentValue) >= Number(expected);
    case '<=': return Number(currentValue) <= Number(expected);
    default:   return true;
  }
};

const coerceValue = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return value;
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  if (!isNaN(parseFloat(trimmed)) && isFinite(trimmed)) return parseFloat(trimmed);
  return value;
};

export const executeAction = async (action, context = {}) => {
  if (!action || !action.type) return { success: false, error: 'Invalid action' };
  const { liveValues = {}, showToast, showConfirm } = context;

  if (action.delay && action.delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, action.delay));
  }
  if (action.condition && !evaluateCondition(action.condition, liveValues)) {
    return { success: true, skipped: true, reason: 'condition_not_met' };
  }
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
    if (!confirmed) return { success: true, skipped: true, reason: 'user_cancelled' };
  }

  try {
    switch (action.type) {
      case 'writeTag':      return await executeWriteTag(action, context);
      case 'toggleTag':     return await executeToggleTag(action, context);
      case 'incrementTag':  return await executeIncrementTag(action, context, 1);
      case 'decrementTag':  return await executeIncrementTag(action, context, -1);
      case 'copyTag':       return await executeCopyTag(action, context);
      case 'changeScreen':  return executeChangeScreen(action, context);
      case 'openPopup':     return executeOpenPopup(action, context);      // ✅ NEW
      case 'closePopup':    return executeClosePopup(action, context);     // ✅ NEW
      case 'showMessage':
      case 'alert':         return executeShowMessage(action, context);
      case 'showPopup':     return executeOpenPopup(action, context);      // legacy alias
      case 'runScript':
      case 'playSound':
        if (showToast) showToast(`Action "${action.type}" not yet implemented`, 'warning');
        return { success: true, skipped: true };
      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
};

const executeWriteTag = async (action) => {
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
  const newValue = !liveValues[targetTag];
  await tagAPI.writeValue(targetTag, newValue);
  return { success: true, wrote: { tag: targetTag, value: newValue } };
};

const executeIncrementTag = async (action, context, sign = 1) => {
  const { targetTag, step = 1 } = action;
  const { liveValues = {} } = context;
  if (!targetTag) throw new Error('incrementTag/decrementTag: targetTag is required');
  const currentValue = Number(liveValues[targetTag]) || 0;
  const newValue = currentValue + sign * Number(step);
  await tagAPI.writeValue(targetTag, newValue);
  return { success: true, wrote: { tag: targetTag, value: newValue } };
};

const executeCopyTag = async (action, context) => {
  const { sourceTag, targetTag } = action;
  const { liveValues = {} } = context;
  if (!sourceTag || !targetTag) throw new Error('copyTag: sourceTag and targetTag are required');
  const value = liveValues[sourceTag];
  if (value === undefined) throw new Error(`copyTag: source tag "${sourceTag}" has no value`);
  await tagAPI.writeValue(targetTag, value);
  return { success: true, wrote: { from: sourceTag, to: targetTag, value } };
};

const executeChangeScreen = (action, context) => {
  const { screenName } = action;
  const { changeScreen, showToast } = context;
  if (!screenName) {
    if (showToast) showToast('changeScreen: no screen name specified', 'warning');
    return { success: false, error: 'screenName is required' };
  }
  if (typeof changeScreen === 'function') {
    changeScreen(screenName);
    console.log(`[EventUtils] changeScreen → "${screenName}"`);
    return { success: true, navigatedTo: screenName };
  }
  if (showToast) showToast(`Navigate to: ${screenName}`, 'info');
  return { success: true, skipped: true, reason: 'not_in_runtime' };
};

// ✅ NEW: openPopup — pushes popup onto the stack
const executeOpenPopup = (action, context) => {
  const { popupName, screenName } = action;
  const name = popupName || screenName; // support legacy 'screenName'
  const { openPopup, showToast } = context;
  if (!name) {
    if (showToast) showToast('openPopup: no popup name specified', 'warning');
    return { success: false, error: 'popupName is required' };
  }
  if (typeof openPopup === 'function') {
    openPopup(name);
    console.log(`[EventUtils] openPopup → "${name}"`);
    return { success: true, openedPopup: name };
  }
  if (showToast) showToast(`Open popup: ${name}`, 'info');
  return { success: true, skipped: true, reason: 'not_in_runtime' };
};

// ✅ NEW: closePopup — pops topmost popup off the stack
const executeClosePopup = (action, context) => {
  const { closePopup, showToast } = context;
  if (typeof closePopup === 'function') {
    closePopup();
    console.log(`[EventUtils] closePopup`);
    return { success: true };
  }
  if (showToast) showToast('Close popup', 'info');
  return { success: true, skipped: true, reason: 'not_in_runtime' };
};

const executeShowMessage = (action, context) => {
  const { text, message, style = 'info' } = action;
  const { showToast } = context;
  const msg = text || message || 'Message';
  if (showToast) showToast(msg, style);
  else alert(msg);
  return { success: true };
};

export const executeEvent = async (eventValue, context = {}) => {
  const actions = normalizeActions(eventValue);
  if (actions.length === 0) return { success: true, results: [], skipped: true };
  const results = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const result = await executeAction(action, context);
    results.push({ actionIndex: i, actionType: action.type, ...result });
    if (!result.success) {
      console.error(`❌ Event stopped at action ${i} (${action.type}):`, result.error);
      if (context.showToast) context.showToast(`Action failed: ${result.error}`, 'error');
      return { success: false, results, error: result.error, failedAt: i };
    }
  }
  return { success: true, results };
};

export const getSupportedActionTypes = () => [
  'writeTag', 'toggleTag', 'incrementTag', 'decrementTag',
  'copyTag', 'changeScreen', 'openPopup', 'closePopup',
  'showMessage', 'alert',
];

export const getSupportedEvents = () => [
  'onClick', 'onDoubleClick', 'onPressLeft', 'onReleaseLeft',
  'onPressRight', 'onReleaseRight', 'onMouseEnter', 'onMouseLeave',
  'onKeyDown', 'onKeyUp', 'onFocus', 'onBlur', 'onValueChange', 'onLoad',
];