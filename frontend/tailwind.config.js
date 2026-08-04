/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════════════════
        // NEW BLUE THEME (matches OnlineSCADA launching website)
        // ═══════════════════════════════════════════════════════

        // ─── Brand palette (from Pankaj's landing site) ───────
        'hero-bg':          '#EEF6FF',
        'site-bg':          '#FFFFFF',
        'brand-primary':    '#0F3D91',
        'brand-accent':     '#2563EB',
        'btn-primary':      '#081B43',
        'btn-hover':        '#123E8A',
        'heading':          '#081B43',
        'paragraph':        '#5F6B7A',
        'border-col':       '#E5E7EB',
        'footer-bg':        '#081B43',
        'footer-text':      '#FFFFFF',
        'footer-secondary': '#B7C3D6',

        // ─── App-specific extensions (semantic tokens) ────────
        surface: {
          DEFAULT: '#FFFFFF',       // cards, panels
          soft:    '#F8FAFC',       // page backgrounds, sidebars
          hover:   '#EEF6FF',       // hover surfaces
          alt:     '#F1F5F9',       // inputs, disabled bgs
        },
        ink: {
          DEFAULT:   '#081B43',     // primary text / headings
          strong:    '#0F172A',     // ultra-strong text
          body:      '#334155',     // body text
          muted:     '#5F6B7A',     // secondary text
          subtle:    '#94A3B8',     // hints, placeholders
        },
        line: {
          DEFAULT: '#E5E7EB',       // default border
          strong:  '#CBD5E1',       // emphasized border
          focus:   '#2563EB',       // focused border
        },

        // ─── Status colors ────────────────────────────────────
        success:      '#16A34A',
        successLight: '#DCFCE7',
        warning:      '#F59E0B',
        warningLight: '#FEF3C7',
        danger:       '#DC2626',
        dangerLight:  '#FEE2E2',
        info:         '#2563EB',
        infoLight:    '#DBEAFE',

        // ─── Runtime canvas (control-room dark) ───────────────
        canvas: {
          dark: '#0F172A',
          grid: '#1E293B',
        },

        // ═══════════════════════════════════════════════════════
        // BACKWARD COMPATIBILITY (old cream/gold names)
        // Now REMAPPED to new blue theme so old code keeps working
        // ═══════════════════════════════════════════════════════
        gold:       '#2563EB',      // was #c9a876
        goldDark:   '#123E8A',      // was #b89560
        goldLight:  '#3B82F6',      // was #d4b88a
        cream:      '#F8FAFC',      // was #f5f0e8
        creamDark:  '#F1F5F9',      // was #ebe3d5
        creamLight: '#FFFFFF',      // was #fbf8f2
        muted:      '#5F6B7A',      // was #7a6f60
        subtle:     '#94A3B8',      // was #a89c8a

        // Keep scada bucket for backward compatibility
        scada: {
          dark:    '#F8FAFC',
          darker:  '#F1F5F9',
          card:    '#FFFFFF',
          border:  '#2563EB',
          accent:  '#2563EB',
          success: '#16A34A',
          warning: '#F59E0B',
          danger:  '#DC2626',
        },
      },
      fontFamily: {
        sans:       ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        inter:      ['Inter', 'sans-serif'],
        // Old "serif" kept but now maps to Montserrat for consistency
        serif:      ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        // ─── New blue theme shadows (from landing site) ───────
        card:         '0px 4px 20px rgba(8, 27, 67, 0.06)',
        'card-hover': '0px 12px 40px rgba(8, 27, 67, 0.12)',
        btn:          '0px 4px 16px rgba(8, 27, 67, 0.25)',
        hero:         '0px 24px 80px rgba(8, 27, 67, 0.15)',

        // ─── Backward compatible (old gold names → blue) ──────
        gold:         '0 4px 14px 0 rgba(37, 99, 235, 0.25)',
        'gold-lg':    '0 10px 25px -3px rgba(37, 99, 235, 0.3)',
      },
      backgroundImage: {
        'hero-gradient':   'linear-gradient(135deg, #F8FBFF 0%, #EEF6FF 100%)',
        'blueprint-grid': `
          linear-gradient(to right, rgba(15, 61, 145, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(15, 61, 145, 0.05) 1px, transparent 1px)
        `,
        'brand-gradient':  'linear-gradient(135deg, #2563EB 0%, #0F3D91 100%)',
      },
      backgroundSize: {
        grid: '40px 40px',
      },
    },
  },
  plugins: [],
}