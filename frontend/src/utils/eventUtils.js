// ═══════════════════════════════════════════════════════════
// eventUtils.js — WinCC-style event execution engine
// ═══════════════════════════════════════════════════════════

/**
 * Normalize any event value into a flat array of action objects.
 * Handles:
 *   - null / undefined  → []
 *   - single action obj → [action]
 *   - array of actions  → as-is
 *   - legacy string     → [{type: 'showMessage', message: str}]
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
 *
 * context shape:
 *  {
 *    liveValues,        // { tagName: value }
 *    navigate,          // react-router navigate fn
 *    showToast,         // (message, type) => void
 *    showConfirm,       // ({ title, message, onConfirm }) => void
 *    currentElement,    // the element that fired the event
 *    allElements,       // all elements on current screen
 *    changeScreen,      // (screenName: string) => void
 *    openPopup,         // (popupName: string) => void
 *    closePopup,        // () => void
 *  }
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
    case 'navigate': {
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
    case 'showPopup': {
      const popupName = action.popupName || action.screenName || action.target;
      if (!popupName) {
        console.warn('[eventUtils] openPopup: no popupName specified');
        return;
      }
      if (openPopup) {
        openPopup(popupName);
      } else {
        console.warn('[eventUtils] openPopup: context.openPopup not provided');
      }
      break;
    }

    case 'closePopup':
    case 'hidePopup': {
      if (closePopup) {
        closePopup();
      } else {
        console.warn('[eventUtils] closePopup: context.closePopup not provided');
      }
      break;
    }

    // ── Tag write ──────────────────────────────────────────
    case 'writeTag':
    case 'setTag': {
      const tagName = action.tagName || action.tag;
      const value   = action.value;
      if (!tagName) {
        console.warn('[eventUtils] writeTag: no tagName specified');
        return;
      }
      try {
        const token = localStorage.getItem('token');
        await fetch('http://localhost:5000/api/tags/write', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ tagName, value }),
        });
      } catch (err) {
        console.error('[eventUtils] writeTag failed:', err);
      }
      break;
    }

    // ── Toggle tag ─────────────────────────────────────────
    case 'toggleTag': {
      const tagName = action.tagName || action.tag;
      if (!tagName) return;
      const current = liveValues[tagName];
      const newVal  = !current;
      try {
        const token = localStorage.getItem('token');
        await fetch('http://localhost:5000/api/tags/write', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ tagName, value: newVal }),
        });
      } catch (err) {
        console.error('[eventUtils] toggleTag failed:', err);
      }
      break;
    }

    // ── Notifications ──────────────────────────────────────
    case 'showMessage':
    case 'showToast': {
      const msg  = action.message || action.text || 'Event fired';
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
          title:     action.title || 'Confirm',
          message:   msg,
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

    // ── Visibility toggles ─────────────────────────────────
    case 'showElement':
    case 'hideElement':
    case 'toggleElement': {
      // These work on design-time data — runtime visibility is controlled
      // by bindings, so these are advisory only (no-op in pure runtime)
      console.debug(`[eventUtils] ${action.type} — target: ${action.elementId}`);
      break;
    }

    // ── Script / eval (sandboxed) ──────────────────────────
    case 'script':
    case 'eval': {
      const code = action.code || action.script;
      if (!code) return;
      try {
        // eslint-disable-next-line no-new-func
        const fn = new Function('liveValues', 'context', code);
        await fn(liveValues, context);
      } catch (err) {
        console.error('[eventUtils] script error:', err);
        if (showToast) showToast(`Script error: ${err.message}`, 'error');
      }
      break;
    }

    // ── Open external URL ──────────────────────────────────
    case 'openUrl':
    case 'navigate_url': {
      const url    = action.url || action.href;
      const target = action.target || '_blank';
      if (url) window.open(url, target);
      break;
    }

    // ── Print / export ─────────────────────────────────────
    case 'print': {
      window.print();
      break;
    }

    // ── No-op / unknown ────────────────────────────────────
    default: {
      console.debug(`[eventUtils] Unknown action type: "${action.type}"`, action);
      break;
    }
  }
}

/**
 * Execute an event value (single action or array) sequentially.
 * All actions run in order; if one throws, the rest still run.
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