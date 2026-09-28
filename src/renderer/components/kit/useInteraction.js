import { useState } from 'react';

// Hover/pressed state for inline-styled components (no CSS :hover allowed).
// Spread `handlers` onto the element and read `hovered` / `pressed`.
export default function useInteraction(disabled = false) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handlers = disabled
    ? {}
    : {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => {
          setHovered(false);
          setPressed(false);
        },
        onMouseDown: () => setPressed(true),
        onMouseUp: () => setPressed(false),
      };

  return { hovered: hovered && !disabled, pressed: pressed && !disabled, handlers };
}

// Merge our interaction handlers with any the caller passed, so both run.
export function mergeHandlers(ours, theirs) {
  const merged = { ...ours };
  for (const key of Object.keys(ours)) {
    if (typeof theirs[key] === 'function') {
      merged[key] = (e) => {
        ours[key](e);
        theirs[key](e);
      };
    }
  }
  return merged;
}
