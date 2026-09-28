import React from 'react';
import theme from '../../config/theme';

export const ICON_STROKE = 1.75;

// Plain glyph for buttons, inputs and tables. Inherits currentColor.
// size: 16 | 18 | 20 | 24
export function Icon({ icon: Glyph, size = 18, style, ...rest }) {
  if (!Glyph) return null;
  return <Glyph size={size} strokeWidth={ICON_STROKE} aria-hidden="true" style={{ flexShrink: 0, ...style }} {...rest} />;
}

const TILE_SIZES = { sm: 24, md: 30, lg: 40, xl: 56 };

// iOS-style rounded-square tile. color: a palette name (blue, green, red,
// orange, yellow, teal, indigo, purple, pink, gray). variant="soft" uses the
// tint background with a colored glyph instead of a white one.
export function IconTile({ icon: Glyph, color = 'blue', size = 'md', variant = 'solid', style }) {
  const px = TILE_SIZES[size] || TILE_SIZES.md;
  const soft = variant === 'soft';
  const c = theme.colors;
  return (
    <span
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        borderRadius: Math.round(px * 0.22),
        backgroundColor: soft ? c[`${color}Tint`] : c[color],
        color: soft ? c[`${color}Text`] || c[color] : c.labelOnAccent,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {Glyph && <Glyph size={Math.round(px * 0.6)} strokeWidth={size === 'sm' ? 2 : ICON_STROKE} />}
    </span>
  );
}
