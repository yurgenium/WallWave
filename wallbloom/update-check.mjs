// Asks GitHub for the latest published release. Sends no user data.
import {fetchJSON} from './network.mjs';

const repository = 'yurgenium/WallWave';

export function isNewerVersion(candidate, current) {
  const parts = value => String(value).split('.').map(Number);
  const a = parts(candidate), b = parts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// The link is built here rather than taken from the response.
export function parseRelease(release) {
  const version = /^v(\d+\.\d+\.\d+)$/.exec(release?.tag_name)?.[1];
  if (!version || release.draft || release.prerelease) return null;
  return {version, url: `https://github.com/${repository}/releases/tag/v${version}`};
}

export async function checkForUpdate(current, {load = fetchJSON, signal} = {}) {
  const release = parseRelease(await load(`https://api.github.com/repos/${repository}/releases/latest`, signal, {
    headers: {Accept: 'application/vnd.github+json', 'User-Agent': 'WallWave'},
  }));
  return release && isNewerVersion(release.version, current) ? release : null;
}
