// ═══════════════════════════════════════════════════════════
// Color Utilities — Normalize colors for HTML inputs
// HTML <input type="color"> requires 6-digit lowercase hex
//
// Default fallbacks updated to match NEW BLUE THEME.
// ═══════════════════════════════════════════════════════════

/**
 * Normalize any color format to 6-digit lowercase hex.
 *
 * Handles:
 *   #fff       → #ffffff
 *   #FFF       → #ffffff
 *   #FFFFFF    → #ffffff
 *   #ffffff80  → #ffffff (strips alpha)
 *   rgb(...)   → #rrggbb
 *   red        → #ff0000
 *   null/empty → default
 */
export function normalizeColor(color, defaultColor = '#ffffff') {
  if (!color || typeof color !== 'string') return defaultColor;

  const trimmed = color.trim().toLowerCase();
  if (!trimmed) return defaultColor;

  // Already valid 6-digit hex
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;

  // 3-digit hex → expand to 6-digit
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return (
      '#' +
      trimmed[1] + trimmed[1] +
      trimmed[2] + trimmed[2] +
      trimmed[3] + trimmed[3]
    );
  }

  // 8-digit hex with alpha → strip alpha
  if (/^#[0-9a-f]{8}$/.test(trimmed)) {
    return trimmed.substring(0, 7);
  }

  // 4-digit hex with alpha → expand and strip alpha
  if (/^#[0-9a-f]{4}$/.test(trimmed)) {
    return (
      '#' +
      trimmed[1] + trimmed[1] +
      trimmed[2] + trimmed[2] +
      trimmed[3] + trimmed[3]
    );
  }

  // rgb(r, g, b) / rgba(r, g, b, a) → convert to hex
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // Named colors → hex equivalent
  const namedColors = {
    black: '#000000', white: '#ffffff', red: '#ff0000',
    green: '#008000', blue: '#0000ff', yellow: '#ffff00',
    orange: '#ffa500', purple: '#800080', pink: '#ffc0cb',
    gray: '#808080', grey: '#808080', cyan: '#00ffff',
    magenta: '#ff00ff', brown: '#a52a2a', silver: '#c0c0c0',
    gold: '#ffd700', navy: '#000080', teal: '#008080',
    lime: '#00ff00', maroon: '#800000',
  };
  if (namedColors[trimmed]) return namedColors[trimmed];

  return defaultColor;
}

/**
 * Validate if a string is a valid 6-digit hex color
 */
export function isValidHex(color) {
  return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color.trim());
}

/**
 * Get contrasting text color (black or white) for readability
 */
export function getContrastColor(bgColor) {
  const hex = normalizeColor(bgColor, '#ffffff');
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}