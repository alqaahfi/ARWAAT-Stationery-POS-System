// Puts a scroll container back where it was after a page remounts. The page
// usually fills with data a moment after it mounts, so keep trying until it
// is tall enough (or a second and a half has passed). Any manual scroll by
// the user cancels the restore. Returns a cancel function.
export function restoreScroll(el, top, timeoutMs = 1500) {
  if (!el || !top) return () => {};
  const started = Date.now();
  let frame = 0;
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    el.removeEventListener('wheel', cancel);
    el.removeEventListener('pointerdown', cancel);
  };
  el.addEventListener('wheel', cancel, { once: true, passive: true });
  el.addEventListener('pointerdown', cancel, { once: true });
  function tick() {
    if (cancelled) return;
    el.scrollTop = top;
    const reached = Math.abs(el.scrollTop - top) < 2;
    if (reached || Date.now() - started > timeoutMs) {
      cancel();
      return;
    }
    frame = requestAnimationFrame(tick);
  }
  tick();
  return cancel;
}
