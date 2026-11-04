import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults, validate} from './core.mjs';
import {chooseNext, rankCandidates} from './automation.mjs';
import {assessLearned, chooseLearned, learnedRank, noteManualChange, noteVote, recentFromHistory, rememberShown, selectionTuning, tasteActive, tasteModelSignature, tasteScore, trainTasteModel} from './taste-model.mjs';
import {embeddingVersion} from './visual-ai.mjs';

const direction = (axis, noise = 0) => { const v = new Array(512).fill(0); v[axis] = 1; v[(axis + 7 + noise) % 512] = .25; return v; };
const item = (id, vote, axis, more = {}) => ({id, vote, embedding: direction(axis, Number(String(id).replace(/\D/g, '')) % 5), embeddingVersion, tags: ['nature'], rating: 'safe', provider: 'local', downloaded: true, ...more});
const many = (prefix, vote, axis, count) => Array.from({length: count}, (_, i) => item(prefix + i, vote, axis));
const fixture = () => [...many('like', 'like', 10, 12), ...many('dislike', 'dislike', 200, 12), ...many('ban', 'ban', 30, 12)];
const database = async (items, settings = {}) => {
  const db = {settings: validate({...defaults, purity: '100', ai: 'auto', ...settings}), providers: [{id: 'local', enabled: true}], items, monitorCurrent: {}};
  db.settings.learnedTaste = true;
  db.tasteModel = await trainTasteModel(items.filter(x => x.vote), {useExclusions: db.settings.learnFromExclusions});
  return db;
};

test('the option is off by default and valid only as a boolean', () => {
  assert.equal(validate(defaults).learnedTaste, false);
  assert.equal(validate(defaults).learnFromExclusions, true);
  assert.throws(() => validate({...defaults, learnedTaste: 'yes'}), /invalidSettings/);
  assert.throws(() => validate({...defaults, learnFromExclusions: 1}), /invalidSettings/);
});

test('training needs enough examples and prefers what was liked', async () => {
  assert.equal(await trainTasteModel([...many('l', 'like', 1, 4), ...many('d', 'dislike', 2, 20)]), null);
  assert.equal(await trainTasteModel([...many('l', 'like', 1, 20), ...many('d', 'dislike', 2, 4)]), null);
  const model = await trainTasteModel(fixture());
  assert.ok(tasteScore(model, direction(10)) > tasteScore(model, direction(200)));
  assert.equal(model.quantiles.length, 101);
  assert.deepEqual(model.quantiles, [...model.quantiles].sort((a, b) => a - b));
});

test('an exclusion ranks above a dislike but below a like, and only when the switch is on', async () => {
  const items = fixture(), withThem = await trainTasteModel(items, {useExclusions: true}), without = await trainTasteModel(items, {useExclusions: false});
  assert.equal(withThem.exclusions, 12);
  assert.equal(without.exclusions, 0);
  assert.equal(without.detail, null);
  const score = direction => tasteScore(withThem, direction);
  assert.ok(score(direction(10)) > score(direction(30)));
  // Excluded pictures are never treated like liked ones.
  assert.notEqual(tasteModelSignature(items, true), tasteModelSignature(items, false));
});

test('exclusions alone can train the model, including after their files were removed', async () => {
  const items = [...many('like', 'like', 10, 8), ...many('ban', 'ban', 30, 8, {})].map(x => x.vote === 'ban' ? {...x, downloaded: false, cachePurged: true, cleanupRemoved: true} : x);
  const model = await trainTasteModel(items);
  assert.equal(model.exclusions, 8);
  assert.ok(tasteScore(model, direction(10)) > tasteScore(model, direction(30)));
});

test('a changed reaction changes the signature; models belong to their own profile', async () => {
  const items = fixture(), before = tasteModelSignature(items, true);
  items[0].vote = 'dislike';
  assert.notEqual(tasteModelSignature(items, true), before);
  const first = await database(fixture()), second = await database([...many('like', 'like', 200, 12), ...many('dislike', 'dislike', 10, 12)]);
  assert.ok(tasteScore(first.tasteModel, direction(10)) > tasteScore(first.tasteModel, direction(200)));
  assert.ok(tasteScore(second.tasteModel, direction(200)) > tasteScore(second.tasteModel, direction(10)));
});

test('the share of likes steers how strict selection is', () => {
  const picks = (selection, likes, others) => [...Array.from({length: likes}, (_, i) => ({id: selection + 'l' + i, selection, vote: 'like'})), ...Array.from({length: others}, (_, i) => ({id: selection + 'o' + i, selection, vote: 'neutral'}))];
  assert.deepEqual(selectionTuning([]), {keepShare: .5, explore: .2, measured: false});
  const good = selectionTuning([...picks('model', 15, 15), ...picks('explore', 1, 9)]);
  assert.equal(good.measured, true);
  assert.ok(good.keepShare < .5);
  assert.equal(good.explore, .15);
  const bad = selectionTuning([...picks('model', 1, 29), ...picks('explore', 4, 6)]);
  assert.ok(bad.keepShare > .5);
  assert.ok(bad.keepShare <= .7);
  assert.equal(bad.explore, .2);
  // Unrated pictures say nothing about the model.
  assert.equal(selectionTuning(picks('model', 0, 30).map(x => ({...x, vote: null}))).measured, false);
});

test('candidates below the threshold are refused, and discovery bypasses the threshold', async () => {
  const model = await trainTasteModel(fixture()), tuning = {keepShare: .5, explore: .2};
  const good = assessLearned(direction(10), model, tuning, () => .9), poor = assessLearned(direction(200), model, tuning, () => .9), discovery = assessLearned(direction(200), model, tuning, () => .1);
  assert.deepEqual([good.rejected, good.selection], [false, 'model']);
  assert.deepEqual([poor.rejected, poor.selection], [true, 'model']);
  assert.deepEqual([discovery.rejected, discovery.selection], [false, 'explore']);
});

test('a requested wallpaper is the best match; automatic changes prefer the least shown', async () => {
  const items = [item('best', null, 10, {rotationCount: 5}), item('fresh-poor', null, 200, {rotationCount: 0}), item('fresh-good', null, 10, {rotationCount: 0})];
  const db = await database([...fixture().map(x => ({...x, downloaded: false})), ...items]);
  const seen = x => x.rotationCount || 0;
  assert.equal(chooseLearned([items[0], items[1]], db, seen, {manual: true, random: () => 0}).id, 'best');
  assert.equal(chooseLearned([items[0], items[1]], db, seen, {random: () => .99}).id, 'fresh-poor');
  assert.equal(chooseLearned(items, db, seen, {random: () => .5 * 0 + .3}).id, 'fresh-good');
});

test('replacing a wallpaper by hand lowers its rank without changing its reaction', async () => {
  const skipped = item('skipped', 'like', 10), other = item('other', 'like', 10);
  const db = await database([...fixture(), skipped, other]);
  const before = learnedRank(skipped, db.tasteModel);
  skipped.skips = 2;
  assert.ok(learnedRank(skipped, db.tasteModel) < before);
  assert.equal(skipped.vote, 'like');
  skipped.skips = 99;
  assert.ok(Math.abs(before - learnedRank(skipped, db.tasteModel) - 1.8) < 1e-9, 'the penalty is capped');
});

test('chooseNext uses the model only when the option is on and passes the request type', async () => {
  const best = item('best', null, 10, {rotationCount: 3}), poor = item('poor', null, 200, {rotationCount: 0});
  const db = await database([...fixture().map(x => ({...x, downloaded: false})), best, poor]);
  assert.equal(tasteActive(db), true);
  assert.equal(chooseNext(db, db.settings, null, () => 0, null, {manual: true}).id, 'best');
  db.settings.learnedTaste = false;
  assert.equal(tasteActive(db), false);
  assert.equal(chooseNext(db, db.settings, null, () => .99, null, {manual: true}).id, 'poor');
});

test('a playlist keeps its own order even with the option on', async () => {
  const best = item('best', null, 10), other = item('other', null, 200);
  const db = await database([...fixture().map(x => ({...x, downloaded: false})), best, other]);
  db.collections = [{id: 'c', items: ['other'], lastShown: {}}];
  db.rotationCollection = 'c';
  assert.equal(chooseNext(db, db.settings, null, () => 0, null, {manual: true}).id, 'other');
});

test('pictures already analysed are tried best first, needing no new request', async () => {
  const noPreview = {id: 'unknown', vote: null, tags: ['nature'], rating: 'safe', provider: 'local'};
  const poor = item('poor', null, 200), good = item('good', null, 10);
  const db = await database([...fixture(), poor, good, noPreview]);
  assert.deepEqual(rankCandidates([noPreview, poor, good], db, () => 0).map(x => x.id), ['good', 'poor', 'unknown']);
  db.settings.learnedTaste = false;
  assert.equal(rankCandidates([noPreview, poor, good], db, () => .99).length, 3);
});

test('recent and on-screen wallpapers do not come back, even when liked and ranked best', async () => {
  const liked = many('liked', 'like', 10, 12), rest = many('rest', null, 200, 40);
  const db = await database([...fixture().map(x => ({...x, downloaded: false})), ...liked, ...rest]);
  db.recentWallpapers = liked.map(x => x.id);
  const all = [...liked, ...rest], seen = x => x.rotationCount || 0;
  db.monitorCurrent = {second: 'rest0'};
  for (let i = 0; i < 40; i++) {
    const picked = chooseLearned(all, db, seen, {manual: true, random: () => i / 40});
    assert.ok(!liked.includes(picked) && picked.id !== 'rest0', picked.id);
  }
  // With nothing else left the choice still works.
  assert.ok(chooseLearned(liked, db, seen, {manual: true, random: () => 0}));
});

test('each shown wallpaper moves to the front; history seeds the list once', () => {
  const db = {};
  for (const id of ['a', 'b', 'a']) rememberShown(db, id);
  assert.deepEqual(db.recentWallpapers, ['a', 'b']);
  assert.deepEqual(recentFromHistory([{current: 'x', monitors: {one: 'x', two: 'y'}}, {current: 'z', monitors: {}}]), ['x', 'y', 'z']);
});

test('a quick manual change is a miss, a long stay is not, and a run of misses is counted', () => {
  const now = 1e9, quick = {id: 'quick'}, long = {id: 'long'}, db = {};
  noteManualChange(db, [quick], [{id: 'quick', since: now - 60000}], now);
  assert.equal(quick.skips, 1);
  assert.equal(db.skipStreak.count, 1);
  noteManualChange(db, [quick], [], now);
  assert.equal(db.skipStreak.count, 2);
  noteManualChange(db, [long], [{id: 'long', since: now - 31 * 60000}], now);
  assert.equal(long.skips, undefined);
  assert.equal(db.skipStreak, null);
});

test('a like on the desktop ends the run and clears skips; a like elsewhere does not', () => {
  const shown = {id: 'shown', skips: 2}, elsewhere = {id: 'elsewhere', skips: 2}, db = {current: 'shown', monitorCurrent: {}, skipStreak: {count: 4, ids: [], at: 1}};
  noteVote(db, elsewhere, 'like');
  assert.equal(db.skipStreak.count, 4);
  assert.equal(elsewhere.skips, 2);
  assert.equal(elsewhere.desktopLike, undefined);
  noteVote(db, shown, 'like');
  assert.equal(db.skipStreak, null);
  assert.equal(shown.skips, undefined);
  assert.equal(shown.desktopLike, true);
  noteVote(db, shown, 'neutral');
  assert.equal(shown.desktopLike, undefined);
});

test('during a run of skips similar pictures lose rank and liked ones are offered a third of the time', async () => {
  const near = item('near', null, 10), far = item('far', null, 40), liked = item('liked', 'like', 60), skipped = item('skipped', null, 10);
  const db = await database([...fixture().map(x => ({...x, downloaded: false})), near, far, liked, skipped]);
  db.tasteModel = {...db.tasteModel, concept: {w: new Array(512).fill(0), b: 0}, detail: null};
  const seen = () => 0, pick = (items, random) => chooseLearned(items, db, seen, {manual: true, random});
  assert.equal(pick([near, far], () => 0).id, 'near');
  db.skipStreak = {count: 1, ids: ['skipped'], at: 1};
  assert.equal(pick([near, far], () => 0).id, 'far');
  db.skipStreak = {count: 3, ids: ['skipped'], at: 1};
  assert.equal(pick([near, far, liked], () => .1).id, 'liked');
  assert.notEqual(pick([near, far, liked], () => .9).id, 'liked');
});

test('skips and likes on the desktop reach training, but never turn a like negative', async () => {
  const items = fixture(), before = tasteModelSignature(items, true);
  const skipped = item('skipped', null, 90, {skips: 2}), plain = await trainTasteModel([...items, {...skipped, skips: 0}]);
  items.push(skipped);
  assert.notEqual(tasteModelSignature(items, true), before);
  const trained = await trainTasteModel(items);
  assert.ok(tasteScore(trained, direction(90)) < tasteScore(plain, direction(90)));
  const signature = tasteModelSignature(items, true);
  items[0].desktopLike = true;
  assert.notEqual(tasteModelSignature(items, true), signature);
  const likedSkip = fixture();
  const unchanged = tasteModelSignature(likedSkip, true);
  likedSkip[0].skips = 3;
  assert.equal(tasteModelSignature(likedSkip, true), unchanged);
});

test('skipped pictures count against the group that chose them', () => {
  const picks = Array.from({length: 30}, (_, i) => ({id: 'm' + i, selection: 'model', vote: null, skips: 1}));
  const explore = Array.from({length: 10}, (_, i) => ({id: 'e' + i, selection: 'explore', vote: i < 4 ? 'like' : 'neutral'}));
  const tuning = selectionTuning([...picks, ...explore]);
  assert.equal(tuning.measured, true);
  assert.ok(tuning.keepShare > .5);
});
