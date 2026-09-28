import React from 'react';
import theme from '../config/theme';

const c = theme.colors;

// The ARWAAT badge: a navy rounded square with a white "A" and a short blue
// bar beneath it (same as the app icon). `size` is the badge width in px.
export default function BrandMark({ size = 56, style }) {
  return (
    <span
      role="img"
      aria-label="ARWAAT"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        backgroundColor: c.brandNavy,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.round(size * 0.04),
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          color: c.labelOnAccent,
          fontFamily: theme.font.family,
          fontWeight: 800,
          fontSize: Math.round(size * 0.5),
          lineHeight: 1,
        }}
      >
        A
      </span>
      <span
        aria-hidden="true"
        style={{
          width: Math.round(size * 0.32),
          height: Math.max(2, Math.round(size * 0.06)),
          borderRadius: theme.radius.pill,
          backgroundColor: c.accent,
        }}
      />
    </span>
  );
}
