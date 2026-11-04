// Personal taste model for one profile. It is stored with that profile's data and
// trained only from embeddings already on this computer, so it makes no requests.
import {createHash} from 'node:crypto';
import {embeddingVersion, validEmbedding} from './visual-ai.mjs';

const steps = 200, rate = 2, lambda = 1e-2, minimumExamples = 5;

const unit = values => {
  let sum = 0;
  for (const v of values) sum += v * v;
  const size = Math.sqrt(sum) || 1;
  return Float64Array.from(values, v => v / size);
};
const usable = x => x.embeddingVersion === embeddingVersion && validEmbedding(x.embedding);
const withVote = (items, vote) => items.filter(x => x.vote === vote && usable(x));
// A skipped picture with no reaction of its own: a weak sign that this choice was wrong.
const skippedOnly = items => items.filter(x => x.skips > 0 && (!x.vote || x.vote === 'neutral') && usable(x));
const skipWeight = x => .25 * Math.min(3, x.skips);

export function tasteModelSignature(items, useExclusions) {
  const votes = useExclusions ? ['like', 'dislike', 'ban'] : ['like', 'dislike'];
  const rated = items.filter(x => votes.includes(x.vote) && usable(x)).map(x => x.id + ':' + x.vote + (x.desktopLike ? ':desktop' : ''));
  const skipped = skippedOnly(items).map(x => x.id + ':skip' + Math.min(3, x.skips));
  return createHash('sha256').update(String(useExclusions) + '|' + [...rated, ...skipped].sort().join('|')).digest('hex').slice(0, 20);
}

async function logistic(rows, pause) {
  const positive = rows.filter(r => r.y === 1).reduce((s, r) => s + r.weight, 0);
  const negative = rows.filter(r => r.y === 0).reduce((s, r) => s + r.weight, 0);
  const share = r => r.weight * (r.y === 1 ? .5 / positive : .5 / negative);
  const w = new Float64Array(512);
  let b = 0;
  for (let step = 0; step < steps; step++) {
    const g = new Float64Array(512);
    let gb = 0;
    for (const r of rows) {
      let z = b;
      for (let i = 0; i < 512; i++) z += w[i] * r.v[i];
      const e = (1 / (1 + Math.exp(-z)) - r.y) * share(r);
      for (let i = 0; i < 512; i++) g[i] += e * r.v[i];
      gb += e;
    }
    for (let i = 0; i < 512; i++) w[i] -= rate * (g[i] + lambda * w[i]);
    b -= rate * gb;
    if (pause && step % 10 === 9) await pause();
  }
  return {w: Array.from(w, v => Math.round(v * 1e5) / 1e5), b: Math.round(b * 1e5) / 1e5};
}

const head = (model, v) => {
  let z = model.b;
  for (let i = 0; i < 512; i++) z += model.w[i] * v[i];
  return z;
};
const scoreUnit = (model, v) => head(model.concept, v) + (model.detail ? head(model.detail, v) : 0);
export const tasteScore = (model, embedding) => scoreUnit(model, unit(embedding));

// An exclusion means "the concept is interesting, this picture is not". So one part
// of the model counts it as a half-weight match for the concept, and another learns
// what separates liked pictures from excluded ones. Files of excluded wallpapers may
// be gone by then; their embeddings stay in the profile data and are still used.
export async function trainTasteModel(items, {useExclusions = true, pause} = {}) {
  const likes = withVote(items, 'like'), dislikes = withVote(items, 'dislike'), bans = useExclusions ? withVote(items, 'ban') : [];
  if (likes.length < minimumExamples || dislikes.length + bans.length < minimumExamples) return null;
  const row = (x, y, weight = 1) => ({v: unit(x.embedding), y, weight});
  // A like given while the picture was on the desktop confirms a choice, so it counts double.
  const liked = x => row(x, 1, x.desktopLike ? 2 : 1), skipped = skippedOnly(items);
  let concept, detail = null;
  if (dislikes.length || skipped.length) concept = await logistic([...likes.map(liked), ...bans.map(x => row(x, 1, .5)), ...dislikes.map(x => row(x, 0)), ...skipped.map(x => row(x, 0, skipWeight(x)))], pause);
  if (bans.length) detail = await logistic([...likes.map(liked), ...bans.map(x => row(x, 0))], pause);
  concept ??= {w: new Array(512).fill(0), b: 0};
  const model = {signature: tasteModelSignature(items, useExclusions), concept, detail, likes: likes.length, dislikes: dislikes.length, exclusions: bans.length};
  // Thresholds come from how all known pictures score, not only from the rated ones.
  const scores = items.filter(usable).map(x => scoreUnit(model, unit(x.embedding))).sort((a, b) => a - b);
  model.quantiles = Array.from({length: 101}, (_, i) => Math.round(scores[Math.min(scores.length - 1, Math.floor(scores.length * i / 100))] * 1e4) / 1e4);
  return model;
}

export const validTasteModel = model => !!model && Array.isArray(model.concept?.w) && model.concept.w.length === 512 && Array.isArray(model.quantiles) && model.quantiles.length === 101;
export const tasteActive = db => db.settings.learnedTaste === true && db.settings.ai !== 'off' && validTasteModel(db.tasteModel);

// The share of likes among recent choices steers selection: when the model's own
// picks earn more likes than random discovery it is trusted more, otherwise less.
export function selectionTuning(items, window = 100) {
  const recent = items.filter(x => x.selection && (['like', 'dislike', 'ban', 'neutral'].includes(x.vote) || x.skips > 0)).sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0)).slice(0, window);
  const share = selection => {
    const group = recent.filter(x => x.selection === selection);
    return {count: group.length, rate: (group.filter(x => x.vote === 'like').length + 1) / (group.length + 8)};
  };
  const model = share('model'), explore = share('explore');
  if (model.count < 20 || explore.count < 5) return {keepShare: .5, explore: .2, measured: false};
  const advantage = model.rate / explore.rate;
  return {keepShare: Math.min(.7, Math.max(.3, .5 - .25 * (advantage - 1))), explore: advantage >= 1.25 ? .15 : .2, measured: true, advantage};
}

export function assessLearned(embedding, model, tuning, random = Math.random) {
  const score = tasteScore(model, embedding);
  const threshold = model.quantiles[Math.round((1 - tuning.keepShare) * 100)];
  if (random() < tuning.explore) return {rejected: false, reason: 'learned', score, threshold, selection: 'explore'};
  return {rejected: score < threshold, reason: 'learned', score, threshold, selection: 'model'};
}

// A wallpaper the user replaced by hand ranks lower; its reaction is not changed.
const skipCost = x => .6 * Math.min(3, x.skips || 0);
export const learnedRank = (x, model) => (usable(x) ? tasteScore(model, x.embedding) : model.quantiles[50]) - skipCost(x);

const recentLimit = 200, longShowMinutes = 30;

// Wallpapers already on a screen or shown recently do not come back, liked or not.
export function rememberShown(db, id) {
  db.recentWallpapers = [id, ...(db.recentWallpapers || []).filter(x => x !== id)].slice(0, recentLimit);
}
export function recentFromHistory(history = []) {
  return [...new Set(history.flatMap(x => [x.current, ...Object.values(x.monitors || {})]).filter(Boolean))].slice(0, recentLimit);
}
function notRecent(items, db) {
  const size = Math.min(40, Math.floor(items.length / 4));
  const blocked = new Set([...(db.recentWallpapers || []).slice(0, size), ...Object.values(db.monitorCurrent || {})]);
  const pool = items.filter(x => !blocked.has(x.id));
  return pool.length ? pool : items;
}

// A wallpaper replaced by hand soon after it appeared was a wrong choice, and several
// in a row mean the model is missing. One that stayed for a long time was not a miss.
export function noteManualChange(db, replaced, exposures = [], now = Date.now()) {
  const longShown = x => { const since = exposures.find(e => e.id === x.id)?.since; return !!since && now - since >= longShowMinutes * 60000; };
  const missed = replaced.filter(x => !longShown(x));
  if (!missed.length) { db.skipStreak = null; return; }
  for (const x of missed) x.skips = (x.skips || 0) + 1;
  const streak = db.skipStreak;
  db.skipStreak = {count: (streak?.count || 0) + 1, ids: [...missed.map(x => x.id), ...(streak?.ids || [])].slice(0, 12), at: now};
}
// A like for the picture on the desktop means the choice worked.
export function noteVote(db, x, vote) {
  if (vote !== 'like') { delete x.desktopLike; return; }
  if (db.current !== x.id && !Object.values(db.monitorCurrent || {}).includes(x.id)) return;
  x.desktopLike = true;
  delete x.skips;
  db.skipStreak = null;
}

// During a run of skips, pictures that look like the skipped ones lose rank.
function missCost(db) {
  const missed = (db.skipStreak?.ids || []).map(id => db.items?.find(x => x.id === id)).filter(x => x && usable(x)).map(x => unit(x.embedding));
  if (!missed.length) return () => 0;
  return x => {
    if (!usable(x)) return 0;
    const v = unit(x.embedding);
    let closest = -1;
    for (const m of missed) { let cos = 0; for (let i = 0; i < 512; i++) cos += m[i] * v[i]; closest = Math.max(closest, cos); }
    return 1.5 * Math.min(1, Math.max(0, (closest - .65) / .2));
  };
}

export function chooseLearned(items, db, seen, {manual = false, random = Math.random, aspectCost = () => 0} = {}) {
  const model = db.tasteModel, pool = notRecent(items, db), least = Math.min(...pool.map(seen)), fresh = pool.filter(x => seen(x) === least);
  const tuning = selectionTuning(db.items), streak = db.skipStreak?.count || 0;
  if (!manual && random() < tuning.explore) return fresh[Math.floor(random() * fresh.length)];
  // On request: the best picture overall. Automatically: the best of the least shown.
  let group = manual ? pool : fresh;
  // After several skips in a row, a third of the requests fall back on what is known to please.
  if (manual && streak >= 3) { const liked = group.filter(x => x.vote === 'like'), rest = group.filter(x => x.vote !== 'like'); if (liked.length && rest.length) group = random() < 1 / 3 ? liked : rest; }
  const miss = missCost(db), rank = x => learnedRank(x, model) - miss(x) - aspectCost(x) - (manual ? .35 * (seen(x) - least) : 0);
  // The more skips in a row, the wider the choice: the top picks were not what was wanted.
  const ranked = group.map(x => ({x, rank: rank(x)})).sort((a, b) => b.rank - a.rank).slice(0, Math.min(15, 3 + 2 * streak));
  return ranked[Math.floor(random() * ranked.length)].x;
}
