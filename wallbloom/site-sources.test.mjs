import test from 'node:test';
import assert from 'node:assert/strict';
import {knownSite,normalizeSite,detectSite,parseBooru,booruURL,searchBooru} from './site-sources.mjs';
import {checkSource} from './source-check.mjs';
import {validateProvider,initialProviders} from './providers.mjs';
import {defaults,AppError} from './core.mjs';
import {credentialFields,credentialValue} from './public/source-credentials.js';
import {supportRequestURL} from './public/source-wizard.js';

const p={id:'test',name:'Test',type:'booru',engine:'danbooru',auth:'none',url:'https://example.org/',enabled:true};
const image={id:42,file_url:'https://cdn.example.org/a.jpg',preview_file_url:'https://cdn.example.org/preview.jpg',tag_string:'mountain lake',rating:'g',image_width:1920,image_height:1080};
test('known domains identify exact credential schemes without impersonating domains',()=>{
 assert.equal(knownSite('https://www.deviantart.com/artist').auth,'client');assert.equal(knownSite('https://rule34.xxx/').auth,'userKey');assert.equal(knownSite('https://rule34.xxx/').url,'https://api.rule34.xxx');assert.equal(knownSite('https://api.rule34.xxx/').auth,'userKey');assert.equal(knownSite('https://danbooru.donmai.us/').engine,'danbooru');assert.equal(knownSite('https://deviantart.com.evil.org'),null);
 for(const url of ['http://example.org','https://user:secret@example.org','https://example.org:444',''])assert.throws(()=>normalizeSite(url));assert.equal(normalizeSite('example.org').protocol,'https:');
 assert(!initialProviders.some(p=>p.type==='booru'),'New websites must never be enabled by migration');
});
test('unknown sites are detected by API shape and unsupported addresses remain unsupported',async()=>{
 const calls=[],opts={check:async()=>{},request:async url=>{calls.push(String(url));if(new URL(url).pathname==='/posts.json')return [image];throw Object.assign(new AppError('sourceUnavailable'),{status:404});}};
 const result=await detectSite('https://example.org',{...opts});assert.equal(result.engine,'danbooru');assert.equal(result.supported,true);assert.equal(result.auth,'none');assert(calls.some(x=>x.includes('rating%3Ag')));
 const unsupported=await detectSite('https://example.org',{check:async()=>{},request:async()=>({html:'not an image API'})});assert.equal(unsupported.supported,false);
 const temporary=await detectSite('https://example.org',{check:async()=>{},request:async()=>{throw Object.assign(new AppError('sourceUnavailable'),{status:503});}});assert.equal(temporary.temporary,true);
 await assert.rejects(detectSite('https://example.org',{check:async()=>{throw new AppError('unsafeURL');}}),{code:'unsafeURL'});
});
test('catalogues and Gelbooru envelopes can be detected without saving any user data',async()=>{
 const feed=await detectSite('https://example.org/catalog.json',{check:async()=>{},request:async()=>({items:[{id:'one',url:'https://example.org/a.jpg',tags:[],rating:'safe'}]})});assert.equal(feed.type,'feed');assert.equal(feed.url,'https://example.org/catalog.json');
 const gel=await detectSite('https://example.org',{check:async()=>{},request:async u=>new URL(u).searchParams.get('page')==='dapi'?{post:[{...image,tags:'landscape'}]}:{}});assert.equal(gel.engine,'gelbooru');
});
test('booru imports keep ratings, tag boundaries and source identity; unsafe and non-image files are skipped',()=>{
 const items=parseBooru([image,{...image,id:43,rating:'s'},{...image,id:44,file_url:'https://example.org/animation.mp4'},{...image,id:45,file_url:'http://example.org/a.jpg'}],p);assert.equal(items.length,2);assert.equal(items[0].rating,'safe');assert.equal(items[1].rating,'suggestive');assert.deepEqual(items[0].tags,['mountain','lake']);assert.equal(items[0].source,'https://example.org/posts/42');assert(items[0].id.startsWith('test-'));
 assert.equal(parseBooru({post:[{...image,rating:'s',tags:'tag_one tag_two'}]},{...p,engine:'gelbooru'})[0].rating,'safe');assert.throws(()=>parseBooru({},p),{code:'invalidFeed'});
});
test('booru pagination distributes interests and credentials stay in site requests',async()=>{
 let called;await searchBooru(p,{...defaults,tags:['lake','mountain']},'',null,3,{request:async url=>{called=url;return [image];}});assert.equal(called.searchParams.get('page'),'2');assert.equal(called.searchParams.get('tags'),'lake rating:g');
 const key=JSON.stringify({user_id:'123',api_key:'FIXTURE_ONLY'}),u=booruURL({...p,engine:'gelbooru',auth:'userKey'},{page:2,key});assert.equal(u.searchParams.get('pid'),'1');assert.equal(u.searchParams.get('user_id'),'123');assert.equal(u.searchParams.get('api_key'),'FIXTURE_ONLY');assert.throws(()=>booruURL({...p,auth:'userKey'}),{code:'apiKeyRequired'});
 assert.throws(()=>validateProvider({...p,engine:'script'}),{code:'invalidProvider'});assert.equal(validateProvider({...p,url:'https://example.org/page'}).url,'https://example.org/');
});
test('credential fields and saved values distinguish client secrets, user IDs and optional login keys',()=>{
 assert.deepEqual(credentialFields('client',x=>x).map(x=>x[0]),['client_id','client_secret']);assert.deepEqual(JSON.parse(credentialValue('userKey',{user_id:'123',api_key:'FIXTURE'})),{user_id:'123',api_key:'FIXTURE'});assert.equal(credentialValue('loginKey',{}),'');assert.throws(()=>credentialValue('client',{client_id:'123'}));assert.throws(()=>credentialValue('userKey',{user_id:'abc',api_key:'FIXTURE'}));
});
test('source checks return counts and preview reachability without credentials or library mutations',async()=>{
 let options;const result=await checkSource(p,defaults,'FIXTURE_SECRET',{search:async(_p,s,key)=>{assert.equal(s.purity,'100');assert.equal(key,'FIXTURE_SECRET');return [{...image,preview:image.preview_file_url}];},bytes:async(_u,o)=>{options=o;return Buffer.from('preview');}});assert.deepEqual(result,{ok:true,count:1,preview:true});assert.equal(options.prefix,1024);assert(!JSON.stringify(result).includes('SECRET'));
 const link=new URL(supportRequestURL('https://name:password@example.org/search?api_key=SECRET',k=>k));assert.equal(link.hostname,'github.com');assert.equal(link.searchParams.get('site'),'https://example.org');assert(!link.href.includes('SECRET'));assert(!link.href.includes('password'));
});
