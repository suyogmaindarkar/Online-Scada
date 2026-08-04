// ═══════════════════════════════════════════════════════════
// Snap to Grid Utilities — Sprint E Phase 2
// ═══════════════════════════════════════════════════════════

const DEFAULT_GRID = 10;

/**
 * Snap a single value to nearest grid point
 * @param {number} value - The value to snap
 * @param {number} gridSize - Grid size (default 10)
 * @returns {number} Snapped value
 */
export const snap = (value, gridSize = DEFAULT_GRID) => {
  if (!gridSize || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
};

/**
 * Snap a position (x, y) to grid
 * @param {number} x
 * @param {number} y
 * @param {number} gridSize
 * @returns {{x, y}} Snapped position
 */
export const snapPoint = (x, y, gridSize = DEFAULT_GRID) => ({
  x: snap(x, gridSize),
  y: snap(y, gridSize),
});

/**
 * Snap size (width, height) with minimum bounds
 */
export const snapSize = (width, height, gridSize = DEFAULT_GRID, minSize = 5) => ({
  width: Math.max(minSize, snap(width, gridSize)),
  height: Math.max(minSize, snap(height, gridSize)),
});

/**
 * Check if Ctrl or Cmd (Mac) key is currently pressed
 * Used to bypass snap during drag/resize
 */
export const isBypassSnapKey = (event) => {
  if (!event) return false;
  return !!(event.ctrlKey || event.metaKey);
};