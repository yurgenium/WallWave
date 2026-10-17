import test from 'node:test';import assert from 'node:assert/strict';import dns from 'node:dns/promises';import https from 'node:https';import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';import {fetchBytes,RequestGate} from './network.mjs';
import {wallhavenQuery} from './providers.mjs';

test('Wallhaven keeps multiword tags and excluded phrases in one search term',()=>{
 assert.equal(wallhavenQuery('video games',['simple background','artist name','landscape']),'"video games" -"simple background" -"artist name" -landscape');
 assert.equal(wallhavenQuery('', ['name, with comma','a "quote"']),' -"name, with comma" -"a \\"quote\\""'.trim());
});

test('shared API gate spaces requests, respects cooldown and cancels waiting requests',async()=>{
 let now=100000;const waits=[],gate=new RequestGate({now:()=>now,wait:async ms=>{waits.push(ms);now+=ms;}});
 await gate.acquire();await gate.acquire();await gate.acquire();assert.deepEqual(waits,[1500,1500]);
 assert.equal(gate.block(120000),120000);assert.equal(gate.block(1000),120000);
 await assert.rejects(gate.acquire(),e=>e.code==='rateLimited'&&e.retryAfter===120000);
 now+=120000;await gate.acquire();assert.equal(gate.block(),60000);
 const cancellable=new RequestGate({interval:60000});await cancellable.acquire();const controller=new AbortController(),pending=cancellable.acquire(controller.signal);controller.abort();await assert.rejects(pending,{name:'AbortError'});
});

test('Wallhaven 429 without Retry-After stops retries and shares cooldown between search and details',async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let connections=0;
 t.mock.method(https,'get',(_,options,resolve)=>{connections++;const req=new EventEmitter();req.setTimeout=()=>{};queueMicrotask(()=>{const res=Readable.from([]);res.statusCode=429;res.headers={};resolve(res);});return req;});
 await assert.rejects(fetchBytes('https://wallhaven.cc/api/v1/search'),e=>e.code==='rateLimited'&&e.retryAfter>=59000);
 await assert.rejects(fetchBytes('https://wallhaven.cc/api/v1/w/example'),{code:'rateLimited'});assert.equal(connections,1);
});

test('missing pages fail once with HTTP status; temporary rate limiting retries automatically',{timeout:10000},async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let tries=0,status=404;
 t.mock.method(https,'get',(_,options,resolve)=>{const req=new EventEmitter();req.setTimeout=()=>{};queueMicrotask(()=>{tries++;const res=Readable.from([Buffer.from('ok')]);res.statusCode=status===429&&tries>1?200:status;res.headers={};resolve(res);});return req;});
 await assert.rejects(fetchBytes('https://example.com/page'),e=>e.status===404&&e.code==='sourceUnavailable');assert.equal(tries,1);
 tries=0;status=429;assert.equal((await fetchBytes('https://example.com/page')).toString(),'ok');assert.equal(tries,2);
});

test('DNS rebinding and redirects cannot connect to private destinations',async t=>{
 let lookups=0,connections=0;
 t.mock.method(dns,'lookup',async()=>[{address:++lookups===1?'8.8.8.8':'127.0.0.1',family:4}]);
 t.mock.method(https,'get',()=>{connections++;throw Error('Unexpected private connection');});
 await assert.rejects(fetchBytes('https://example.com/image'),{code:'unsafeURL'});assert.equal(connections,0);
 t.mock.method(dns,'lookup',async host=>[{address:host==='private.example'?'10.0.0.1':'8.8.8.8',family:4}]);
 t.mock.method(https,'get',(_,options,resolve)=>{
  connections++;assert.equal(typeof options.lookup,'function');const req=new EventEmitter();req.setTimeout=()=>{};
  queueMicrotask(()=>{const res=Readable.from([]);res.statusCode=302;res.headers={location:'https://private.example/image'};resolve(res);});return req;
 });
 await assert.rejects(fetchBytes('https://example.com/image'),{code:'unsafeURL'});assert.equal(connections,1);
});

test('oversized declared and streamed responses stop at the byte limit',async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);
 let declared=true,connections=0;
 t.mock.method(https,'get',(_,options,resolve)=>{
  connections++;const req=new EventEmitter();req.setTimeout=()=>{};
  queueMicrotask(()=>{const res=Readable.from([Buffer.alloc(4),Buffer.alloc(4)]);res.statusCode=200;res.headers=declared?{'content-length':'8'}:{};resolve(res);});return req;
 });
 await assert.rejects(fetchBytes('https://example.com/image',{limit:5}),{code:'itemLimit'});
 declared=false;await assert.rejects(fetchBytes('https://example.com/image',{limit:5}),{code:'itemLimit'});
 assert.equal(connections,2,'size violations do not retry');
});
test('transient failures retry; transfer timeout allows continued progress; abort cancels retries',{timeout:10000},async t=>{t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let tries=0;const timeouts=[];t.mock.method(https,'get',(_,options,resolve)=>{const req=new EventEmitter();req.setTimeout=ms=>timeouts.push(ms);req.destroy=e=>req.emit('error',e);queueMicrotask(()=>{if(++tries<3){req.emit('error',Object.assign(Error('reset'),{code:'ECONNRESET'}));return;}const res=Readable.from([Buffer.from('complete')]);res.statusCode=200;res.headers={'content-length':'8'};resolve(res);});return req;});assert.equal((await fetchBytes('https://example.com/image')).toString(),'complete');assert.equal(tries,3);assert.deepEqual(timeouts,[120000,120000,120000]);const c=new AbortController();c.abort();await assert.rejects(fetchBytes('https://example.com/image',{signal:c.signal}),{name:'AbortError'});assert.equal(tries,3);});
test('forbidden destinations are never retried or connected',async t=>{t.mock.method(dns,'lookup',async()=>[{address:'127.0.0.1',family:4}]);let connected=false;t.mock.method(https,'get',()=>{connected=true;});await assert.rejects(fetchBytes('https://example.com/image'),e=>e.code==='unsafeURL');assert.equal(connected,false);});
test('a bounded batch transfer times out once so another wallpaper can replace it',async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let calls=0;
 const keepAlive=setTimeout(()=>{},2000);t.after(()=>clearTimeout(keepAlive));
 t.mock.method(https,'get',(_,options)=>{calls++;const req=new EventEmitter();req.setTimeout=()=>{};options.signal.addEventListener('abort',()=>req.emit('error',options.signal.reason),{once:true});return req;});
 await assert.rejects(fetchBytes('https://example.com/slow',{timeoutMs:20,attempts:1}),e=>['TimeoutError','AbortError'].includes(e.name));assert.equal(calls,1);
});
test('metadata requests stop after the requested prefix even if the host ignores Range',async t=>{t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let range; t.mock.method(https,'get',(_,options,resolve)=>{range=options.headers.Range;const req=new EventEmitter();req.setTimeout=()=>{};queueMicrotask(()=>{const res=Readable.from([Buffer.alloc(100),Buffer.alloc(100)]);res.statusCode=200;res.headers={'content-length':'2000000'};resolve(res);});return req;});assert.equal((await fetchBytes('https://example.com/image',{prefix:128,limit:128})).length,128);assert.equal(range,'bytes=0-127');});

test('an aborted response stream preserves timeout instead of becoming a connection reset',async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let calls=0;
 const keepAlive=setTimeout(()=>{},2000);t.after(()=>clearTimeout(keepAlive));
 t.mock.method(https,'get',(_,options,resolve)=>{calls++;const req=new EventEmitter();req.setTimeout=()=>{};const res=new Readable({read(){}});res.statusCode=200;res.headers={'content-length':'100'};options.signal.addEventListener('abort',()=>res.destroy(Object.assign(Error('aborted stream'),{code:'ECONNRESET'})),{once:true});queueMicrotask(()=>resolve(res));return req;});
 await assert.rejects(fetchBytes('https://example.com/slow-body',{timeoutMs:20,attempts:1}),{name:'TimeoutError'});assert.equal(calls,1);
});