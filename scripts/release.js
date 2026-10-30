// npm run release        -> bump the patch version (1.1.0 -> 1.1.1)
// npm run release:minor  -> bump the minor version (1.0.0 -> 1.1.0)
// Then: commit the bump, push, build the renderer, and have electron-builder build the
// installer and upload it to GitHub as a DRAFT release (installer, blockmap, latest.yml).
// The draft is published by hand on GitHub. Tokens are only checked for being set,
// never printed:  GH_TOKEN (uploads the release)  and  GH_UPDATE_TOKEN (read-only,
// baked into the app so installed copies can look for updates).
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const bump = process.argv[2] === 'minor' ? 'minor' : 'patch';

// With shell:true on Windows the arguments are joined into one command line, so quote the ones with spaces.
const quote = (a) => (/[\s"]/.test(a) ? `"${String(a).replace(/"/g, '\\"')}"` : a);

function run(cmd, args, { capture = false } = {}) {
  const res = spawnSync(cmd, args.map(quote), { cwd: root, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', shell: process.platform === 'win32', encoding: 'utf8' });
  if (res.status !== 0) {
    console.error(`\nStopped: "${cmd} ${args.join(' ')}" failed.`);
    process.exit(res.status || 1);
  }
  return capture ? String(res.stdout || '').trim() : '';
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

for (const name of ['GH_TOKEN', 'GH_UPDATE_TOKEN']) {
  const set = !!(process.env[name] || '').trim();
  console.log(`${name}: ${set ? 'set' : 'missing'}`);
  if (!set) fail(`${name} is not set. Set it, restart the terminal / VS Code, and run the release again.`);
}

if (run('git', ['status', '--porcelain'], { capture: true })) {
  fail('There are uncommitted changes. Commit them first (a release is built from committed code), then run the release again.');
}

// Fails here (before anything is bumped) if the update token can't be baked in.
run('node', ['scripts/write-update-token.js', '--require']);

run('npm', ['version', bump, '--no-git-tag-version']);
const version = require(path.join(root, 'package.json')).version;
console.log(`\nVersion is now ${version}`);
run('git', ['add', 'package.json', 'package-lock.json']);
run('git', ['commit', '-m', `Release v${version}`]);
run('git', ['push', '-u', 'origin', 'HEAD']);

run('npm', ['run', 'build:renderer']);
run('npx', ['electron-builder', '--win', '--publish', 'always']);

console.log(`\nDraft release for v${version} uploaded. Open GitHub -> Releases, add short notes and press Publish.`);
