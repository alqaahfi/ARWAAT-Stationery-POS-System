import { useEffect, useRef } from 'react';

let counter = 0;

// Tells the main process this window is in the middle of entering a sale, return or
// purchase while `active` is true. The updater refuses to restart the app while any
// window reports busy (see main/update/entryBusy.js).
export default function useEntryBusy(active, label) {
  const keyRef = useRef(null);
  if (keyRef.current === null) {
    counter += 1;
    keyRef.current = `${label}-${counter}`;
  }
  useEffect(() => {
    const key = keyRef.current;
    const setBusy = window.api?.app?.setBusy;
    if (!setBusy) return undefined;
    Promise.resolve(setBusy({ key, busy: !!active })).catch(() => {});
    return () => {
      Promise.resolve(setBusy({ key, busy: false })).catch(() => {});
    };
  }, [active]);
}
