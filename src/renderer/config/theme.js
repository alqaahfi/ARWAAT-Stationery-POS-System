// src/renderer/config/theme.js
const theme = {
  colors: {
    appBackground: '#f4f6f9',
    sidebarBackground: '#1b2b45',
    sidebarBackgroundActive: '#24395c',
    cardBackground: '#ffffff',
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',

    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    textOnSidebar: '#cbd5e1',
    textOnSidebarActive: '#ffffff',
    textOnDark: '#f8fafc',

    primary: '#1d4ed8',
    primaryHover: '#1e40af',
    primaryText: '#ffffff',

    success: '#15803d',
    successBackground: '#f0fdf4',
    warning: '#b45309',
    warningBackground: '#fffbeb',
    danger: '#b91c1c',
    dangerBackground: '#fef2f2',
    info: '#0369a1',
    infoBackground: '#f0f9ff',

    accentBlue: '#1d4ed8',
    accentGreen: '#15803d',
    accentAmber: '#b45309',
    accentPurple: '#6d28d9',
  },
  spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  radius: { sm: '4px', md: '6px', lg: '8px' },
  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.06)',
    dropdown: '0 2px 8px rgba(15, 23, 42, 0.12)',
  },
  font: {
    family: "'Segoe UI', Arial, Helvetica, sans-serif",
    sizeXs: '12px', sizeSm: '13px', sizeBase: '14px', sizeMd: '16px', sizeLg: '20px', sizeXl: '24px',
    weightNormal: 400, weightMedium: 500, weightSemibold: 600,
  },
};
export default theme;
