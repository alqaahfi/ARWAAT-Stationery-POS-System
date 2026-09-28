import React from 'react';
import theme from '../config/theme';

// The one allowed <style> block in the app. It holds only what inline styles
// cannot express: keyframes, focus rings, placeholder/selection colors,
// scrollbars, base body text, and the reduced-motion override.
const c = theme.colors;

const css = `
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pop-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

body {
  margin: 0;
  font-family: ${theme.font.family};
  font-size: ${theme.type.body.fontSize};
  line-height: ${theme.type.body.lineHeight};
  background-color: ${c.bg};
  color: ${c.label};
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

:focus-visible { outline: 3px solid ${c.focusRing}; outline-offset: 1px; }
[data-ui-check]:focus-visible + [data-ui-check-box] { box-shadow: 0 0 0 3px ${c.focusRing}; }

[data-ui-input]:focus, [data-ui-input]:focus-visible {
  outline: none;
  border-color: ${c.accent} !important;
  box-shadow: 0 0 0 3px ${c.focusRing};
}
[data-ui-input][aria-invalid="true"]:focus, [data-ui-input][aria-invalid="true"]:focus-visible {
  border-color: ${c.red} !important;
  box-shadow: 0 0 0 3px ${c.errorRing};
}
input::placeholder, textarea::placeholder { color: ${c.labelTertiary}; opacity: 1; }

::selection { background-color: ${c.accentTint}; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: ${c.fillStrong};
  border: 2px solid transparent;
  background-clip: content-box;
  border-radius: ${theme.radius.pill};
}
::-webkit-scrollbar-thumb:hover { background-color: ${c.labelTertiary}; }
::-webkit-scrollbar-corner { background: transparent; }

@media (prefers-reduced-motion: reduce) {
  *:not([data-ui-spinner]), *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;

export default function GlobalStyles() {
  return <style>{css}</style>;
}
