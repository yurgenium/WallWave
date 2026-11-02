import test from 'node:test';
import assert from 'node:assert/strict';
import {powershell} from './windows.mjs';
import {diagnosticError} from './diagnostics.mjs';

// A cold powershell.exe start can exceed the normal 10 s limit on busy CI runners.
const coldStartLimit=60000;

test('failed native commands expose useful codes without persisting private stderr', {skip:process.platform!=='win32'},async()=>{
 await assert.rejects(powershell("Write-Error 'PRIVATE_USER C:\\private\\photo.jpg SECRET_KEY 0x80070005';exit 1",{},'applyMonitor',coldStartLimit),error=>{
  assert.equal(error.code,'windowsUnavailable');const safe=diagnosticError(error);
  assert.equal(safe.reason,'nativeCommandFailed');assert.equal(safe.nativeOperation,'applyMonitor');assert.equal(safe.exitCode,1);assert.equal(safe.hresult,'0x80070005');
  for(const secret of ['PRIVATE_USER','SECRET_KEY','photo.jpg'])assert(!JSON.stringify(safe).includes(secret));return true;
 });
});

test('long-lived host and one-shot calls keep Cyrillic paths intact', {skip:process.platform!=='win32'},async()=>{
 const {native}=await import('./windows.mjs');
 const value='C:\\Users\\Юрий\\Обои\\фото.jpg';
 assert.equal((await native('$env:WALLWAVE_TEST_VALUE',{WALLWAVE_TEST_VALUE:value},'unknown')).trim(),value);
 assert.equal((await powershell('$env:WALLWAVE_TEST_VALUE',{WALLWAVE_TEST_VALUE:value},'unknown',coldStartLimit)).trim(),value);
});

test('activity checks reuse one host process', {skip:process.platform!=='win32'},async()=>{
 const {activity,native}=await import('./windows.mjs');
 const first=await activity(),second=await activity();
 assert.equal(first.supported,true);assert.equal(second.supported,true);assert.equal(typeof second.idle,'number');
 const pid=async()=>(await native('$PID',{},'unknown')).trim();
 assert.equal(await pid(),await pid());
});
