import React from 'react';
import theme from '../../config/theme';

const c = theme.colors;
const TINTS = ['blue', 'green', 'orange', 'teal', 'indigo', 'purple', 'pink', 'yellow'];
const SIZES = { 28: theme.type.caption, 36: theme.type.footnote, 56: theme.type.title2 };

function initials(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : words[0][1] || '';
  return (first + last).toUpperCase();
}

// Same name -> same tint, every time.
function tintFor(name = '') {
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

// Decorative initials circle. size: 28 | 36 | 56.
export function Avatar({ name, size = 36, style }) {
  const px = SIZES[size] ? size : 36;
  const tint = tintFor(name);
  return (
    <span
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        borderRadius: theme.radius.pill,
        backgroundColor: c[`${tint}Tint`],
        color: c[`${tint}Text`],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: theme.font.family,
        ...SIZES[px],
        fontWeight: theme.font.weightSemibold,
        lineHeight: 1,
        userSelect: 'none',
        ...style,
      }}
    >
      {initials(name)}
    </span>
  );
}
