// ═══════════════════════════════════════════════════════════
// Production Security Guard — Inspect Element & DevTools Blocker
// Runs ONLY in production mode (import.meta.env.PROD)
// ═══════════════════════════════════════════════════════════

export function initSecurityGuard() {
  // Only activate in production build (Vercel)
  if (!import.meta.env.PROD) return;

  // 1. Disable Right-Click (Context Menu)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  // 2. Block Inspection Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }

    // Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+Shift+C (Inspect)
    if (e.ctrlKey && e.shiftKey && (
      e.key === 'I' || e.key === 'i' ||
      e.key === 'J' || e.key === 'j' ||
      e.key === 'C' || e.key === 'c'
    )) {
      e.preventDefault();
      return false;
    }

    // Ctrl+U / Cmd+Option+U (View Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      return false;
    }

    // Ctrl+S / Cmd+S (Save Page)
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      return false;
    }
  });

  // 3. DevTools Anti-Debugging Trap
  // If a user forces DevTools open via browser menu, this infinite loop pauses execution
  setInterval(() => {
    const startTime = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    const endTime = performance.now();
    // If DevTools is open, execution pauses at debugger and diff > 100ms
    if (endTime - startTime > 100) {
      console.clear();
    }
  }, 1000);
}