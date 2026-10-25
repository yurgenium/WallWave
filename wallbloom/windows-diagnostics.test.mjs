import test from 'node:test';
import assert from 'node:assert/strict';
import {powershell} from './windows.mjs';
import {diagnosticError} from './diagnostics.mjs';

test('failed native commands expose useful codes without persisting private stderr', {skip:process.platform!=='win32'},async()=>{
 await assert.rejects(powershell("Write-Error 'PRIVATE_USER C:\\private\\photo.jpg SECRET_KEY 0x80070005';exit 1",{},'applyMonitor'),error=>{
  assert.equal(error.code,'windowsUnavailable');const safe=diagnosticError(error);
  assert.equal(safe.reason,'nativeCommandFailed');assert.equal(safe.nativeOperation,'applyMonitor');assert.equal(safe.exitCode,1);assert.equal(safe.hresult,'0x80070005');
  for(const secret of ['PRIVATE_USER','SECRET_KEY','photo.jpg'])assert(!JSON.stringify(safe).includes(secret));return true;
 });
});
