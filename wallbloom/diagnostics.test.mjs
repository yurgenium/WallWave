import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {defaults,AppError} from './core.mjs';
import {diagnosticContext,diagnosticError,availabilityReason,DiagnosticJournal} from './diagnostics.mjs';

test('selection diagnostics distinguish filters, monitor restrictions, source state and exhausted alternatives',()=>{
 const db={settings:{...defaults,purity:'111',tags:['SECRET_TAG'],excludedTags:['PRIVATE_EXCLUSION'],monitors:{SECRET_SCREEN:{purity:'100'}}},providers:[{id:'SECRET_PROVIDER',enabled:true}],items:[
  {id:'SECRET_IMAGE',downloaded:true,rating:'adult',tags:[],provider:'SECRET_PROVIDER'},
  {id:'excluded',downloaded:true,rating:'safe',tags:['PRIVATE_EXCLUSION'],provider:'SECRET_PROVIDER'},
  {id:'banned',downloaded:true,rating:'safe',tags:[],vote:'ban',provider:'SECRET_PROVIDER'}],current:'SECRET_IMAGE',monitorCurrent:{SECRET_SCREEN:'SECRET_IMAGE'}};
 const report=diagnosticContext(db,{monitors:[{id:'SECRET_SCREEN',width:1920,height:1080}],monitorSettings:()=>({...db.settings,purity:'100'})});
 assert.equal(report.selection.eligible,1);assert.equal(report.selection.alternatives,0);
 assert.equal(report.monitors[0].selection.eligible,0);assert.equal(report.monitors[0].selection.blocked.ratingBlocked,1);
 assert.equal(report.selection.blocked.excludedTags,1);assert.equal(report.selection.blocked.rejectedVote,1);
 assert.equal(availabilityReason(null,db.settings),'itemMissing');assert.equal(availabilityReason({...db.items[0],downloaded:false},db.settings),'notDownloaded');
 for(const secret of ['SECRET_TAG','PRIVATE_EXCLUSION','SECRET_SCREEN','SECRET_PROVIDER','SECRET_IMAGE'])assert(!JSON.stringify(report).includes(secret));
});

test('persistent failures retain their version and reason across restarts, successes and history eviction',async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-diagnostics-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const file=path.join(temp,'history.json'),journal=await new DiagnosticJournal(file,'0.6.10').open();
 const error=new AppError('notAvailable');error.message='PRIVATE_PATH SECRET_KEY';error.diagnostic={reason:'ratingBlocked',stage:'eligibility',monitor:2,raw:'PRIVATE_PATH',url:'https://private.example'};
 journal.failure('refresh','notAvailable',error,{secret:'SECRET_KEY'});
 for(let i=0;i<25;i++)journal.finish(journal.begin('next',{}),{code:'wallpaperChanged'});
 journal.begin('apply',{});await journal.flush();
 const restarted=await new DiagnosticJournal(file,'0.6.11').open(),history=restarted.snapshot();
 assert.equal(history.operations.length,20);assert.equal(history.operations[0].status,'interrupted');
 assert.equal(history.lastFailure.version,'0.6.10');assert.equal(history.lastFailure.action,'refresh');assert.equal(history.lastFailure.error.reason,'ratingBlocked');assert.equal(history.lastFailure.error.monitor,2);
 const serialized=JSON.stringify(history);for(const secret of ['PRIVATE_PATH','SECRET_KEY','private.example'])assert(!serialized.includes(secret));
 // Older or manually edited files cannot add private fields to a public report.
 const saved=JSON.parse(await fs.readFile(file,'utf8'));saved.lastFailure.password='SECRET_KEY';saved.lastFailure.context.rawPath='PRIVATE_PATH';saved.lastFailure.error.stack='PRIVATE_PATH';await fs.writeFile(file,JSON.stringify(saved));
 assert(!JSON.stringify((await new DiagnosticJournal(file,'0.6.11').open()).snapshot()).includes('SECRET_KEY'));
 assert(!JSON.stringify((await new DiagnosticJournal(file,'0.6.11').open()).snapshot()).includes('PRIVATE_PATH'));
});

test('native diagnostics keep exit/HRESULT codes but omit command output, paths and exception messages',()=>{
 const error=Object.assign(new Error('C:\\Users\\PRIVATE_USER\\picture.jpg SECRET_KEY'),{code:'windowsUnavailable',diagnostic:{reason:'nativeCommandFailed',stage:'native',nativeOperation:'applyMonitor',exitCode:1,hresult:'0x80070005',stderr:'SECRET_KEY'}});
 const safe=diagnosticError(error);assert.equal(safe.exitCode,1);assert.equal(safe.hresult,'0x80070005');assert.equal(safe.nativeOperation,'applyMonitor');
 assert(!JSON.stringify(safe).includes('PRIVATE_USER'));assert(!JSON.stringify(safe).includes('SECRET_KEY'));
});
