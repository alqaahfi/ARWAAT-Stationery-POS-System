// src/renderer/components/DevPanel/devPanelTheme.js
//
// The Dev Panel is explicitly a diagnostic tool, not a shop-facing screen —
// it's allowed to look more utilitarian/technical than the rest of the app
// (monospace data, denser tables). It still builds from theme.js's base
// tokens rather than inventing a separate color system.
import theme from '../../config/theme';

const devPanelTheme = {
  ...theme,
  font: {
    ...theme.font,
    mono: "'Cascadia Mono', 'Consolas', 'Courier New', monospace",
  },
  colors: {
    ...theme.colors,
    // A dark, "console"-like chrome for the overlay itself, distinct from
    // the rest of the app, while table content stays on the light surface
    // colors above for readability at density.
    panelBackground: '#0f172a',
    panelBackgroundAlt: '#16223e',
    panelBorder: '#293b5f',
    panelText: '#e2e8f0',
    panelTextSecondary: '#94a3b8',
  },
};

export default devPanelTheme;
