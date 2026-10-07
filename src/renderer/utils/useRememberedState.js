import { useCallback, useState } from 'react';

// Like useState, but the value outlives the component: opening an item and
// coming back to its list finds the search, filters and sort exactly as left.
// Kept in memory only, so a real app restart starts fresh.
const memory = new Map();

export default function useRememberedState(key, initial) {
  const [value, setValue] = useState(() => (memory.has(key) ? memory.get(key) : typeof initial === 'function' ? initial() : initial));
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        memory.set(key, resolved);
        return resolved;
      });
    },
    [key]
  );
  return [value, set];
}
