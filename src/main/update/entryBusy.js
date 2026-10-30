// Which windows are in the middle of entering a sale / return / purchase.
// Renderers report it through app:set-busy (see renderer/utils/useEntryBusy.js);
// the updater refuses to restart the app while anything here is busy.
const busyByWindow = new Map(); // webContents id -> Set of keys

function setBusy(webContentsId, key, busy) {
  if (webContentsId === undefined || webContentsId === null || !key) return;
  let keys = busyByWindow.get(webContentsId);
  if (busy) {
    if (!keys) busyByWindow.set(webContentsId, (keys = new Set()));
    keys.add(String(key).slice(0, 80));
  } else if (keys) {
    keys.delete(String(key));
    if (keys.size === 0) busyByWindow.delete(webContentsId);
  }
}

function clearWindow(webContentsId) {
  busyByWindow.delete(webContentsId);
}

function isAnyBusy() {
  for (const keys of busyByWindow.values()) if (keys.size > 0) return true;
  return false;
}

module.exports = { setBusy, clearWindow, isAnyBusy };
