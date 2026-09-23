// ═══════════════════════════════════════════════════════════
// eventUtils.js — WinCC-style Event Execution Engine
//
// ✅ FIXED: Replaced hardcoded localhost fetch with central tagAPI & Socket.io
// ✅ FIXED: Supported all SCADA/WinCC action types (setTag, toggleTag, setBit, etc.)
// ✅ FIXED: Real-time write command forwarding to Edge Gateway
// ═══════════════════════════════════════════════════════════

import api, { tagAPI } from '../services/api';
import socketService from '../services/socket';

/**
 * Normalize any event value into a flat array of action objects.
 */
export function normalizeActions(eventValue) {
  if (!eventValue) return [];
  if (Array.isArray(eventValue)) return eventValue.filter(Boolean);
  if (typeof eventValue === 'object') return [eventValue];
  if (typeof eventValue === 'string' && eventValue.trim()) {
    return [{ type: 'showMessage', message: eventValue }];
  }
  return [];
}

/**
 * Execute a single action object given a runtime context.
 */
async function executeAction(action, context) {
  if (!action || !action.type) return;

  const {
    liveValues = {},
    navigate,
    showToast,
    showConfirm,
    currentElement,
    allElements = [],
    changeScreen,
    openPopup,
    closePopup,
  } = context;

  switch (action.type) {

    // ── Navigation ─────────────────────────────────────────
    case 'changeScreen':
    case 'navigate':
    case 'CHANGE_SCREEN':
    case 'NAVIGATE': {
      const target = action.screenName || action.target || action.screen;
      if (!target) {
        console.warn('[eventUtils] changeScreen: no screenName specified');
        return;
      }
      if (changeScreen) {
        changeScreen(target);
      } else if (navigate) {
        navigate(`/runtime?screen=${encodeURIComponent(target)}`);
      }
      break;
    }

    // ── Popups ─────────────────────────────────────────────
    case 'openPopup':
    case 'showPopup':
    case 'OPEN_POPUP': {
      const popupName = action.popupName || action.screenName || action.target;
      if (!popupName) {
        console.warn('[eventUtils] openPopup: no popupName specified');
        return;
      }
      if (openPopup) {
        openPopup(popupName);
      }
      break;
    }

    case 'closePopup':
    case 'hidePopup':
    case 'CLOSE_POPUP': {
      if (closePopup) {
        closePopup();
      }
      break;
    }

    // ── Tag Write ──────────────────────────────────────────
    case 'writeTag':
    case 'setTag':
    case 'setValue':
    case 'WRITE_TAG':
    case 'SET_TAG':
    case 'WRITE_VALUE':
    case 'SET_VALUE': {
      const tagName = action.tagName || action.tag || action.targetTag;
      let value = action.value;
      if (value === undefined) value = action.targetValue;

      if (!tagName) {
        console.warn('[eventUtils] writeTag: no tagName specified in action', action);
        return;
      }

      try {
        // 1. Send via central REST API
        await tagAPI.writeValue(tagName, value);
        // 2. Emit via Socket.io for instant live update
        socketService.emit('writeTag', { tagName, value });
      } catch (err) {
        console.error('[eventUtils] writeTag failed:', err);
        if (showToast) showToast(`Write failed: ${err.message || 'Error'}`, 'error');
      }
      break;
    }

    // ── Toggle Tag ─────────────────────────────────────────
    case 'toggleTag':
    case 'toggleValue':
    case 'TOGGLE_TAG':
    case 'TOGGLE_VALUE': {
      const tagName = action.tagName || action.tag || action.targetTag;
      if (!tagName) return;

      const current = liveValues[tagName];
      const newVal = !current;

      try {
        await tagAPI.writeValue(tagName, newVal);
        socketService.emit('writeTag', { tagName, value: newVal });
      } catch (err) {
        console.error('[eventUtils] toggleTag failed:', err);
        if (showToast) showToast(`Toggle failed: ${err.message || 'Error'}`, 'error');
      }
      break;
    }

    // ── Bit Operations ─────────────────────────────────────
    case 'setBit':
    case 'SET_BIT': {
      const tagName = action.tagName || action.tag || action.targetTag;
      const bitIndex = action.bitIndex ?? action.bit ?? 0;
      if (!tagName) return;

      const current = Number(liveValues[tagName] || 0);
      const newVal = current | (1 << bitIndex);

      try {
        await tagAPI.writeValue(tagName, newVal);
        socketService.emit('writeTag', { tagName, value: newVal });
      } catch (err) {
        console.error('[eventUtils] setBit failed:', err);
      }
      break;
    }

    case 'resetBit':
    case 'RESET_BIT': {
      const tagName = action.tagName || action.tag || action.targetTag;
      const bitIndex = action.bitIndex ?? action.bit ?? 0;
      if (!tagName) return;

      const current = Number(liveValues[tagName] || 0);
      const newVal = current & ~(1 << bitIndex);

      try {
        await tagAPI.writeValue(tagName, newVal);
        socketService.emit('writeTag', { tagName, value: newVal });
      } catch (err) {
        console.error('[eventUtils] resetBit failed:', err);
      }
      break;
    }

    case 'toggleBit':
    case 'TOGGLE_BIT': {
      const tagName = action.tagName || action.tag || action.targetTag;
      const bitIndex = action.bitIndex ?? action.bit ?? 0;
      if (!tagName) return;

      const current = Number(liveValues[tagName] || 0);
      const newVal = current ^ (1 << bitIndex);

      try {
        await tagAPI.writeValue(tagName, newVal);
        socketService.emit('writeTag', { tagName, value: newVal });
      } catch (err) {
        console.error('[eventUtils] toggleBit failed:', err);
      }
      break;
    }

    // ── Notifications ──────────────────────────────────────
    case 'showMessage':
    case 'showToast': {
      const msg = action.message || action.text || 'Event fired';
      const type = action.messageType || action.toastType || 'info';
      if (showToast) showToast(msg, type);
      else alert(msg);
      break;
    }

    case 'showConfirm':
    case 'confirm': {
      const msg = action.message || action.text || 'Are you sure?';
      if (showConfirm) {
        showConfirm({
          title: action.title || 'Confirm',
          message: msg,
          onConfirm: async () => {
            if (action.onConfirmActions) {
              for (const a of normalizeActions(action.onConfirmActions)) {
                await executeAction(a, context);
              }
            }
          },
        });
      } else {
        if (window.confirm(msg)) {
          if (action.onConfirmActions) {
            for (const a of normalizeActions(action.onConfirmActions)) {
              await executeAction(a, context);
            }
          }
        }
      }
      break;
    }

    // ── Script Execution ──────────────────────────────────
    case 'script':
    case 'eval': {
      const code = action.code || action.script;
      if (!code) return;
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('liveValues', 'context', 'tagAPI', 'socketService', code);
        await fn(liveValues, context, tagAPI, socketService);
      } catch (err) {
        console.error('[eventUtils] script error:', err);
        if (showToast) showToast(`Script error: ${err.message}`, 'error');
      }
      break;
    }

    // ── External URL ──────────────────────────────────────
    case 'openUrl':
    case 'navigate_url': {
      const url = action.url || action.href;
      const target = action.target || '_blank';
      if (url) window.open(url, target);
      break;
    }

    case 'print': {
      window.print();
      break;
    }

    default: {
      console.debug(`[eventUtils] Unknown action type: "${action.type}"`, action);
      break;
    }
  }
}

/**
 * Execute an event value (single action or array) sequentially.
 */
export async function executeEvent(eventValue, context) {
  const actions = normalizeActions(eventValue);
  if (actions.length === 0) return;

  for (const action of actions) {
    try {
      await executeAction(action, context);
    } catch (err) {
      console.error('[eventUtils] Action failed:', action, err);
    }
  }
}

export default executeEvent;