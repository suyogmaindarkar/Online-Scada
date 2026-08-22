// ═══════════════════════════════════════════════════════════
// OnlineSCADA — Central Theme Colors
// Mirrors the palette used on the launching website (Pankaj's repo)
//
// Use these constants ANYWHERE you need inline `style={{ ... }}`
// values. For Tailwind classes, use `bg-brand-primary`, `text-heading`,
// `border-line`, etc. from `tailwind.config.js`.
// ═══════════════════════════════════════════════════════════

export const COLORS = {
  // ─── Brand palette (from Pankaj's landing site) ───────────
  heroBg:         '#EEF6FF',
  siteBg:         '#FFFFFF',
  brandPrimary:   '#0F3D91',   // deep blue
  brandAccent:    '#2563EB',   // royal blue accent
  btnPrimary:     '#2563EB',   // brand blue button
  btnHover:       '#1D4ED8',   // button hover
  heading:        '#081B43',   // all headings
  paragraph:      '#5F6B7A',   // body text
  borderCol:      '#E5E7EB',   // default borders
  footerBg:       '#081B43',
  footerText:     '#FFFFFF',
  footerSecondary:'#B7C3D6',

  // ─── App-specific extensions ──────────────────────────────
  surface:      '#FFFFFF',
  surfaceSoft:  '#F8FAFC',
  surfaceHover: '#EEF6FF',
  surfaceAlt:   '#F1F5F9',

  inkPrimary:   '#081B43',
  inkStrong:    '#0F172A',
  inkBody:      '#334155',
  inkMuted:     '#5F6B7A',
  inkSubtle:    '#94A3B8',

  lineDefault:  '#E5E7EB',
  lineStrong:   '#CBD5E1',
  lineFocus:    '#2563EB',

  // ─── Status colors ────────────────────────────────────────
  success:      '#16A34A',
  successLight: '#DCFCE7',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  danger:       '#DC2626',
  dangerLight:  '#FEE2E2',
  info:         '#2563EB',
  infoLight:    '#DBEAFE',

  // ─── Runtime canvas (dark for control-room) ───────────────
  canvasDark:   '#0F172A',
  canvasGrid:   '#1E293B',

  // ─── Gradients (as strings) ───────────────────────────────
  gradients: {
    brand:  'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
    hero:   'linear-gradient(135deg, #F8FBFF 0%, #EEF6FF 100%)',
    dark:   'linear-gradient(135deg, #081B43 0%, #0F3D91 100%)',
    card:   'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
  },

  // ─── Shadows (as strings) ─────────────────────────────────
  shadows: {
    card:       '0px 4px 20px rgba(8, 27, 67, 0.06)',
    cardHover:  '0px 12px 40px rgba(8, 27, 67, 0.12)',
    btn:        '0px 4px 16px rgba(8, 27, 67, 0.25)',
    hero:       '0px 24px 80px rgba(8, 27, 67, 0.15)',
  },

  // ─── Font families ────────────────────────────────────────
  fonts: {
    heading: "'Montserrat', -apple-system, sans-serif",
    body:    "'Inter', -apple-system, sans-serif",
  },
};

// Convenience default export for `import COLORS from '../theme/colors'`
export default COLORS;