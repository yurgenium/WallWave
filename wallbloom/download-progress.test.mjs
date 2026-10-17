import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadProgress,progressText,refreshSummary} from './public/download-progress.js';
test('download counters describe selected wallpapers and saved files, independent of candidates and byte progress',()=>{
 const job={kind:'refresh',target:24,downloaded:1,ready:4,active:2,done:12,total:139,bytes:800000,itemTotal:1000000};
 const expected={target:24,downloaded:1,prepared:5,active:2,waiting:2};assert.deepEqual(downloadProgress(job),expected);
 assert.deepEqual(downloadProgress({...job,total:220,done:33,bytes:0,itemTotal:0}),expected);
 assert.equal(progressText('Скачано: {count} из {target}',1,24),'Скачано: 1 из 24');
 assert.equal(progressText('Downloaded: {count} of {target}',1,24),'Downloaded: 1 of 24');
});
test('partial, failed and cancelled results keep the actual saved count without masking newer errors',()=>{
 const t=key=>({downloadedCount:'Скачано: {count} из {target}',poolPartial:'Частично',cancelled:'Отменено',sourceUnavailable:'Источник недоступен'})[key]||key;
 assert.equal(refreshSummary({refreshOutcome:'poolPartial',refreshDownloaded:1,refreshTarget:24,refreshReason:'cancelled'},t),'Частично · Скачано: 1 из 24 · Отменено');
 assert.equal(refreshSummary({lastRefresh:20,lastError:{time:19,code:'sourceUnavailable'},refreshOutcome:'sourceUnavailable',refreshDownloaded:0,refreshTarget:24},t),'Источник недоступен · Скачано: 0 из 24');
 assert.equal(refreshSummary({lastRefresh:20,lastError:{time:21,code:'differentError'},refreshOutcome:'poolUpdated',refreshDownloaded:24,refreshTarget:24},t),'');
 assert(refreshSummary({refreshOutcome:'poolUpdated',refreshDownloaded:1,refreshTarget:1,refreshReason:'reserveBatchLimited'},t).endsWith('reserveBatchLimited'));
 assert(!refreshSummary({refreshOutcome:'poolUpdated',refreshDownloaded:24,refreshTarget:24,refreshReason:'aiDeferred'},t).includes('aiDeferred'));
});
test('starting and finishing have bounded counters; other jobs keep their own progress',()=>{
 assert.deepEqual(downloadProgress({kind:'refresh'}),{target:0,downloaded:0,prepared:0,active:0,waiting:0});
 assert.deepEqual(downloadProgress({kind:'refresh',target:24,downloaded:24,ready:1,active:1}),{target:24,downloaded:24,prepared:24,active:0,waiting:0});
 assert.equal(downloadProgress({kind:'ai',total:139,done:12}),null);assert.equal(downloadProgress(null),null);
});
