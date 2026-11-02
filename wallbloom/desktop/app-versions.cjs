// Removes old unpacked versions from <install>\app after a successful start.
const path = require('node:path');

const productId = 'app.wallbloom.desktop';
const isVersion = name => /^\d+\.\d+\.\d+$/.test(name);
const compare = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// Keeps the running version, anything newer and the `keep` closest older ones.
function staleVersions(names, current, keep = 2) {
  return names.filter(name => isVersion(name) && compare(name, current) < 0).sort(compare).reverse().slice(keep);
}

const readIni = bytes => bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8');

// `fs` must be Electron's original-fs: its regular fs treats app.asar as a folder.
async function pruneVersions({execPath, version, fs, keep = 2}) {
  const runtime = path.dirname(execPath), apps = path.dirname(runtime);
  if (path.basename(runtime) !== version || path.basename(apps) !== 'app') return [];
  let ini;
  try {
    ini = readIni(await fs.readFile(path.join(path.dirname(apps), 'installation.ini')));
  } catch {
    return [];
  }
  // Only touch a folder WallWave owns and that currently points at this version.
  if (!ini.includes(`Product=${productId}`) || !ini.includes(`Version=${version}`)) return [];
  const folders = (await fs.readdir(apps, {withFileTypes: true})).filter(x => x.isDirectory() && !x.isSymbolicLink()).map(x => x.name);
  const removed = [];
  for (const name of staleVersions(folders, version, keep)) {
    try {
      await fs.rm(path.join(apps, name), {recursive: true, force: true, maxRetries: 2});
      removed.push(name);
    } catch {}
  }
  return removed;
}

module.exports = {staleVersions, pruneVersions};
