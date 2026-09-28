// src/renderer/config/theme.js
// Single source of design tokens. Components read ONLY these values (never raw
// hex/rgb), so a dark mode later is just a second set of values for the same keys.

// --- Semantic palette (iOS-style, light) ---
const palette = {
  accent: '#007AFF',
  brandNavy: '#1B2B45', // ARWAAT brand badge (matches the app icon)
  accentPressed: '#0062CC',
  accentTint: 'rgba(0,122,255,0.12)',
  accentTintStrong: 'rgba(0,122,255,0.2)',

  green: '#34C759',
  greenTint: 'rgba(52,199,89,0.12)',
  greenText: '#177A33',
  red: '#FF3B30',
  redTint: 'rgba(255,59,48,0.12)',
  redTintStrong: 'rgba(255,59,48,0.2)',
  redText: '#D70015',
  redPressed: '#D70015',
  orange: '#FF9500',
  orangeTint: 'rgba(255,149,0,0.12)',
  orangeText: '#B25000',
  yellow: '#FFCC00',
  yellowTint: 'rgba(255,204,0,0.12)',
  yellowText: '#8A6D00',
  teal: '#30B0C7',
  tealTint: 'rgba(48,176,199,0.12)',
  tealText: '#0E7C8C',
  indigo: '#5856D6',
  indigoTint: 'rgba(88,86,214,0.12)',
  indigoText: '#4745B8',
  purple: '#AF52DE',
  purpleTint: 'rgba(175,82,222,0.12)',
  purpleText: '#8944AB',
  pink: '#FF2D55',
  pinkTint: 'rgba(255,45,85,0.12)',
  pinkText: '#C7002B',
  gray: '#8E8E93',
  grayTint: 'rgba(142,142,147,0.14)',
  grayText: '#6C6C70',
  blue: '#007AFF',
  blueTint: 'rgba(0,122,255,0.12)',
  blueText: '#0062CC',

  bg: '#F2F2F7',
  sidebar: '#EFEFF4', // app shell sidebar: a tint between page bg and cards
  surface: '#FFFFFF',
  surfaceAlt: '#F9F9FB',
  fill: 'rgba(118,118,128,0.12)',
  fillStrong: 'rgba(118,118,128,0.2)',

  label: '#1C1C1E',
  labelSecondary: '#6C6C70',
  labelTertiary: '#8E8E93',
  labelOnAccent: '#FFFFFF',

  separator: 'rgba(60,60,67,0.16)',
  separatorStrong: 'rgba(60,60,67,0.29)',

  scrim: 'rgba(0,0,0,0.32)',
  material: 'rgba(255,255,255,0.86)', // translucent sheet (modals/toasts), solid fallback = surface
  focusRing: 'rgba(0,122,255,0.4)',
  errorRing: 'rgba(255,59,48,0.3)',
  shimmer: 'rgba(255,255,255,0.6)',
};

const theme = {
  colors: {
    ...palette,

    // --- Legacy names (kept so existing pages keep resolving) ---
    appBackground: palette.bg,
    cardBackground: palette.surface,
    border: palette.separator,
    borderStrong: palette.separatorStrong,
    textPrimary: palette.label,
    textSecondary: palette.labelSecondary,
    textOnDark: '#f8fafc',
    primary: palette.accent,
    primaryHover: palette.accentPressed,
    primaryText: palette.labelOnAccent,
    success: palette.greenText,
    successBackground: palette.greenTint,
    warning: palette.orangeText,
    warningBackground: palette.orangeTint,
    danger: palette.redText,
    dangerBackground: palette.redTint,
    info: palette.accent,
    infoBackground: palette.accentTint,
    accentBlue: palette.blue,
    accentGreen: palette.green,
    accentAmber: palette.orange,
    accentPurple: palette.purple,

    // --- Sidebar (light shell since Phase 2; old names kept alive) ---
    sidebarBackground: palette.sidebar,
    sidebarBackgroundActive: palette.accentTint,
    textOnSidebar: palette.labelSecondary,
    textOnSidebarActive: palette.label,
  },

  spacing: { xxs: '2px', xs: '4px', sm: '8px', smd: '12px', md: '16px', mdl: '20px', lg: '24px', xl: '32px', xxl: '48px' },

  radius: { xs: '6px', sm: '8px', md: '10px', lg: '14px', xl: '20px', pill: '999px' },

  shadow: {
    card: '0 1px 2px rgba(0,0,0,0.04)',
    dropdown: '0 4px 16px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
    popover: '0 8px 28px rgba(0,0,0,0.14), 0 0 0 0.5px rgba(0,0,0,0.06)',
    modal: '0 20px 60px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)',
    segment: '0 1px 3px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.04)',
    knob: '0 2px 4px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.04)',
  },

  font: {
    family: "'Inter Variable', Inter, system-ui, 'Segoe UI', sans-serif",
    mono: "'Cascadia Mono', Consolas, 'Courier New', monospace",
    numeric: { fontVariantNumeric: 'tabular-nums' },
    // Legacy keys
    sizeXs: '12px', sizeSm: '13px', sizeBase: '14px', sizeMd: '16px', sizeLg: '20px', sizeXl: '24px',
    weightNormal: 400, weightMedium: 500, weightSemibold: 600, weightBold: 700,
  },

  // Spreadable text styles: <div style={{ ...theme.type.headline }}>
  type: {
    largeTitle: { fontSize: '28px', fontWeight: 700, lineHeight: '34px', letterSpacing: '-0.02em' },
    title1: { fontSize: '22px', fontWeight: 700, lineHeight: '28px', letterSpacing: '-0.015em' },
    title2: { fontSize: '18px', fontWeight: 600, lineHeight: '24px', letterSpacing: '-0.01em' },
    headline: { fontSize: '15px', fontWeight: 600, lineHeight: '20px', letterSpacing: '-0.005em' },
    body: { fontSize: '14px', fontWeight: 400, lineHeight: '20px', letterSpacing: '0' },
    subhead: { fontSize: '13px', fontWeight: 400, lineHeight: '18px', letterSpacing: '0' },
    footnote: { fontSize: '12px', fontWeight: 400, lineHeight: '16px', letterSpacing: '0' },
    caption: { fontSize: '11px', fontWeight: 500, lineHeight: '14px', letterSpacing: '0.02em' },
  },

  motion: {
    fast: '120ms',
    base: '180ms',
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },

  control: { sm: '28px', md: '34px', lg: '40px', input: '36px', row: '44px' },
};

export default theme;
