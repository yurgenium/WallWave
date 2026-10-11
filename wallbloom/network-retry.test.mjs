import test from 'node:test';import assert from 'node:assert/strict';import dns from 'node:dns/promises';import https from 'node:https';import {EventEmitter} from 'node:events';import {Readable} from 'node:stream';import {fetchBytes} from './network.mjs';

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
test('metadata requests stop after the requested prefix even if the host ignores Range',async t=>{t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let range; t.mock.method(https,'get',(_,options,resolve)=>{range=options.headers.Range;const req=new EventEmitter();req.setTimeout=()=>{};queueMicrotask(()=>{const res=Readable.from([Buffer.alloc(100),Buffer.alloc(100)]);res.statusCode=200;res.headers={'content-length':'2000000'};resolve(res);});return req;});assert.equal((await fetchBytes('https://example.com/image',{prefix:128,limit:128})).length,128);assert.equal(range,'bytes=0-127');});
