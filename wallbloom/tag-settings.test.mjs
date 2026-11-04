import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate,allowed} from './core.mjs';
import {parseTags,formatTags,tagListError,maxTags,repairSplitTags} from './public/tag-input.js';
import {searchTags} from './public/tag-editor.js';
import {wallhavenQuery} from './providers.mjs';
const tags=Array.from({length:1000},(_,i)=>'тег '+i);
test('interests, exclusions and monitor interests each accept 1000 tags with specific boundary errors',()=>{
 const settings=validate({...defaults,tags,excludedTags:tags,monitors:{screen:{rotation:true,rotationMinutes:3,purity:'100',tags}}});assert.equal(settings.tags.length,maxTags);assert.equal(settings.excludedTags.length,1000);assert.equal(settings.monitors.screen.tags.length,1000);
 for(const key of ['tags','excludedTags'])assert.throws(()=>validate({...defaults,[key]:[...tags,'extra']}),{code:'tooManyTags'});
 assert.throws(()=>validate({...defaults,monitors:{screen:{rotation:true,rotationMinutes:3,purity:'100',tags:[...tags,'extra']}}}),{code:'tooManyTags'});
 assert.equal(tagListError(['я'.repeat(80)]),null);assert.throws(()=>validate({...defaults,tags:['я'.repeat(81)]}),{code:'tagTooLong'});assert.throws(()=>validate({...defaults,pauseProcesses:tags}),{code:'invalidSettings'});
});
test('CSV parsing handles a thousand tags, exact comma names and case-insensitive duplicates',()=>{
 const list=[...tags.slice(0,998),'artist, sample','Artist "Name"'];assert.deepEqual(parseTags(formatTags(list)),list);assert.deepEqual(parseTags('Nature, nature, ПРИРОДА, природа'),['Nature','ПРИРОДА']);
});
test('tag search matches partial names in both languages without changing the stored list',()=>{
 const list=['Nature','Природа','artist, sample'];assert.deepEqual(searchTags(list,'NAT'),['Nature']);assert.deepEqual(searchTags(list,' РОДА '),['Природа']);assert.deepEqual(searchTags(list,', sample'),['artist, sample']);assert.deepEqual(searchTags(list,'missing'),[]);assert.deepEqual(list,['Nature','Природа','artist, sample']);assert.equal(searchTags(list,''),list);
});
test('a thousand exclusions keep the remote query bounded while all exclusions still block locally',()=>{
 const excluded=Array.from({length:1000},(_,i)=>'длинный исключённый тег '+i),query=wallhavenQuery('nature',excluded);assert(encodeURIComponent(query).length<=1500);assert(query.includes(excluded[0]));assert(!query.includes(excluded.at(-1)));assert.equal(allowed({rating:'safe',tags:[excluded.at(-1)]},{...defaults,excludedTags:excluded}),false);
});

test('tags an older version split at a comma are joined again; other tags stay',()=>{
 const known=['Warhammer 40,000','nature','artist, sample'];
 assert.deepEqual(repairSplitTags(['nature','Warhammer 40','000','space'],known),['nature','Warhammer 40,000','space']);
 assert.deepEqual(repairSplitTags(['artist','sample'],known),['artist, sample']);
 assert.deepEqual(repairSplitTags(['Warhammer 40','000','Warhammer 40,000'],known),['Warhammer 40,000']);
 assert.deepEqual(repairSplitTags(['000','Warhammer 40'],known),['000','Warhammer 40'],'only neighbours in the original order are joined');
 assert.deepEqual(repairSplitTags(['Warhammer 40','000'],['nature']),['Warhammer 40','000'],'nothing is joined without a known original');
 const once=repairSplitTags(['Warhammer 40','000'],known);assert.deepEqual(parseTags(formatTags(once)),once);assert.deepEqual(repairSplitTags(once,known),once);
});
