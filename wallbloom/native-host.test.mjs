import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHost, asciiJson} from './native-host.mjs';

// A stand-in for the PowerShell loop that speaks the same line protocol.
const fake = String.raw`
const rl=require('node:readline').createInterface({input:process.stdin});
const send=o=>process.stdout.write(JSON.stringify(o)+'\n');
if(process.env.FAKE_MODE==='silent'){}else if(process.env.FAKE_MODE==='crash'){process.exit(3);}else send({ready:true});
process.stdout.write('noise that is not json\n');
rl.on('line',line=>{const r=JSON.parse(line);const [op,arg]=r.script.split(':');
 if(op==='echo')send({id:r.id,ok:true,out:arg});
 else if(op==='env')send({id:r.id,ok:true,out:r.env.VALUE});
 else if(op==='pid')send({id:r.id,ok:true,out:String(process.pid)});
 else if(op==='fail')send({id:r.id,ok:false,err:'boom 0x80070005'});
 else if(op==='sleep')setTimeout(()=>send({id:r.id,ok:true,out:'late'}),Number(arg));
 else if(op==='die')process.exit(1);});`;

const host = (mode, options = {}) => createNativeHost({command: process.execPath, args: ['-e', fake], env: {FAKE_MODE: mode || ''}, ...options});

test('host runs queued calls in order on one process', async t => {
  const h = host();
  t.after(() => h.close());
  const results = await Promise.all([h.run('echo:a'), h.run('echo:b'), h.run('pid'), h.run('pid')]);
  assert.deepEqual(results.slice(0, 2), ['a', 'b']);
  assert.equal(results[2], results[3], 'both calls used the same process');
});

test('non-ASCII text survives the pipe in both directions', async t => {
  const h = host();
  t.after(() => h.close());
  const path = 'C:\\Users\\Юрий\\Обои\\фото 😀.jpg';
  assert.equal(await h.run('env', {VALUE: path}), path);
  assert.ok(/^[\x00-\x7f]*$/.test(asciiJson({path})));
});

test('script errors keep the host and expose the HRESULT', async t => {
  const h = host();
  t.after(() => h.close());
  const before = await h.run('pid');
  await assert.rejects(h.run('fail', {}, 'applyMonitor'), e => e.code === 'windowsUnavailable' && e.diagnostic.reason === 'nativeCommandFailed' && e.diagnostic.hresult === '0x80070005' && e.diagnostic.nativeOperation === 'applyMonitor');
  assert.equal(await h.run('pid'), before);
});

test('a stuck call times out and the next call gets a fresh process', async t => {
  const h = host('', {timeout: 200});
  t.after(() => h.close());
  const before = await h.run('pid');
  await assert.rejects(h.run('sleep:5000', {}, 'activity'), e => e.diagnostic.reason === 'nativeTimeout');
  const after = await h.run('pid');
  assert.notEqual(after, before);
});

test('a crash during a call fails only that call', async t => {
  const h = host();
  t.after(() => h.close());
  await assert.rejects(h.run('die'), e => e.diagnostic.reason === 'nativeCommandFailed');
  assert.equal(await h.run('echo:ok'), 'ok');
});

test('a host that cannot start reports hostUnavailable and is not retried at once', async t => {
  for (const [mode, options] of [['crash', {}], ['silent', {startTimeout: 200}]]) {
    const h = host(mode, options);
    t.after(() => h.close());
    await assert.rejects(h.run('echo:a'), e => e.hostUnavailable === true);
    assert.equal(h.available, false);
    await assert.rejects(h.run('echo:a'), e => e.hostUnavailable === true);
  }
});

test('a missing executable reports hostUnavailable', async t => {
  const h = createNativeHost({command: '/nonexistent/powershell.exe', args: []});
  t.after(() => h.close());
  await assert.rejects(h.run('echo:a'), e => e.hostUnavailable === true);
});
