// The read-only GitHub token baked in at build time (scripts/write-update-token.js
// writes updateToken.generated.js from the GH_UPDATE_TOKEN build variable). It is
// only ever handed to electron-updater / the release-notes request — never logged,
// stored in the database, audited or put into an error message.
function getUpdateToken() {
  try {
    // eslint-disable-next-line global-require
    const generated = require('./updateToken.generated');
    return generated && typeof generated.token === 'string' && generated.token ? generated.token : null;
  } catch {
    return null;
  }
}

// Removes the token (and anything that looks like a GitHub token) from text that
// might be shown or logged.
function scrub(text) {
  let out = String(text == null ? '' : text);
  const token = getUpdateToken();
  if (token) out = out.split(token).join('[token]');
  return out.replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, '[token]');
}

module.exports = { getUpdateToken, scrub };
