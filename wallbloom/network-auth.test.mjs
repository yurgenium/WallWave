import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {fetchJSON,fetchBytes} from './network.mjs';

test('OAuth POST uses a body; authenticated redirects cannot forward credentials',async t=>{
 t.mock.method(dns,'lookup',async()=>[{address:'8.8.8.8',family:4}]);let connections=0,body;
 t.mock.method(https,'request',(url,options,resolve)=>{connections++;assert.equal(new URL(url).search,'');assert.equal(options.method,'POST');const req=new EventEmitter();req.setTimeout=()=>{};req.end=value=>{body=value;queueMicrotask(()=>{const res=Readable.from([Buffer.from('{"access_token":"test"}')]);res.statusCode=200;res.headers={};resolve(res);});};return req;});
 assert.equal((await fetchJSON('https://www.deviantart.com/oauth2/token',null,{method:'POST',body:'client_secret=fixture'})).access_token,'test');assert.equal(body,'client_secret=fixture');
 t.mock.method(https,'get',(url,options,resolve)=>{connections++;const req=new EventEmitter();req.setTimeout=()=>{};queueMicrotask(()=>{const res=Readable.from([]);res.statusCode=302;res.headers={location:'https://other.example/'};resolve(res);});return req;});
 await assert.rejects(fetchBytes('https://www.deviantart.com/api/v1/oauth2/browse/tags',{headers:{Authorization:'Bearer fixture'}}),{code:'unsafeURL'});assert.equal(connections,2);
});
