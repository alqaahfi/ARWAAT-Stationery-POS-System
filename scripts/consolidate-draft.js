// electron-builder uploads the installer, blockmap and latest.yml in parallel and sometimes creates
// TWO draft releases for the same version, each holding part of the files. This makes sure the
// version ends up with exactly one draft that holds all three, then removes the leftover duplicate.
// Used by scripts/release.js (and runnable alone: node scripts/consolidate-draft.js). Needs env GH_TOKEN.
const fs = require('fs');
const path = require('path');

const OWNER = 'arwaheed';
const REPO = 'arwaat-pos-system';
const root = path.join(__dirname, '..');

async function gh(method, url, { body, headers } = {}) {
  const res = await fetch(url, {
    method,
    body,
    headers: { Authorization: `token ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'arwaat-release', ...headers },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON
  }
  return { status: res.status, json };
}

async function consolidate(version) {
  const tag = `v${version}`;
  const list = await gh('GET', `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=30`);
  if (list.status !== 200) throw new Error(`Could not list releases (HTTP ${list.status}).`);
  const drafts = list.json.filter((r) => r.draft && r.tag_name === tag);
  if (drafts.length === 0) throw new Error(`No draft release for ${tag} was found.`);

  // Local files electron-builder produced, under the names GitHub gives them (spaces -> hyphens).
  const wanted = {};
  for (const f of fs.readdirSync(path.join(root, 'release'))) {
    if (f.includes(`Setup ${version}`) && (f.endsWith('.exe') || f.endsWith('.exe.blockmap')) && !f.includes('__uninstaller')) wanted[f.replace(/ /g, '-')] = path.join(root, 'release', f);
  }
  if (fs.existsSync(path.join(root, 'release', 'latest.yml'))) wanted['latest.yml'] = path.join(root, 'release', 'latest.yml');

  const score = (r) => (r.assets.some((a) => a.name === 'latest.yml') ? 100 : 0) + r.assets.length;
  const keep = [...drafts].sort((a, b) => score(b) - score(a))[0];
  const have = new Set(keep.assets.map((a) => a.name));
  for (const [name, file] of Object.entries(wanted)) {
    if (have.has(name)) continue;
    const up = await gh('POST', `${keep.upload_url.split('{')[0]}?name=${encodeURIComponent(name)}`, {
      body: fs.readFileSync(file),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    if (up.status !== 201) throw new Error(`Could not add ${name} to the draft (HTTP ${up.status}).`);
    console.log(`Added ${name} to the draft.`);
  }
  for (const extra of drafts.filter((r) => r.id !== keep.id)) {
    await gh('DELETE', `https://api.github.com/repos/${OWNER}/${REPO}/releases/${extra.id}`);
    console.log('Removed an incomplete duplicate draft.');
  }
  return keep.html_url;
}

module.exports = { consolidate };

if (require.main === module) {
  consolidate(require(path.join(root, 'package.json')).version)
    .then((url) => console.log(`Draft release: ${url}`))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
