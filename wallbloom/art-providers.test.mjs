import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ArtSources,automaticSource} from './art-providers.mjs';
import {defaults,allowed,AppError} from './core.mjs';

test('Konachan maps ratings and file provenance, normalizes multiword search and preserves tag commas',async()=>{
 const requests=[],client=new ArtSources({request:async url=>{requests.push(new URL(url));return [{id:1,rating:'s',tags:'mountain_lake warhammer_40,000',file_url:'//konachan.com/image/one.jpg',preview_url:'https://konachan.com/preview/one.jpg',width:1920,height:1080,file_size:2000},{id:2,rating:'e',tags:'test',file_url:'https://konachan.com/two.jpg'},{id:3,rating:'unknown',file_url:'https://konachan.com/three.jpg'}];}});
 const p={id:'custom',type:'konachan'},s={...defaults,tags:['mountain lake','forest'],excludedTags:['bad tag'],purity:'100'};
 const images=await client.search(p,s,null,null,3);assert.equal(requests[0].searchParams.get('page'),'2');assert.equal(requests[0].searchParams.get('tags'),'mountain_lake rating:s -bad_tag');assert.equal(images.length,2);assert.equal(images[0].id,'custom-1');assert.equal(images[0].source,'https://konachan.com/post/show/1');assert(images[0].tags.includes('warhammer 40,000'));assert.equal(allowed(images[1],s),false);
 for(const [purity,query]of [['110','-rating:e'],['101','-rating:q'],['010','rating:q'],['001','rating:e'],['011','-rating:s']]){await client.search(p,{...s,purity},null,null);assert(requests.at(-1).searchParams.get('tags').includes(query));}
});

test('Pixabay requests remain manual and cached for 24 hours across restarts without persisting keys',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-pixabay-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));let now=100000,calls=0;
 const request=async url=>{calls++;assert.equal(new URL(url).searchParams.get('safesearch'),'true');return {totalHits:1,hits:[{id:4,tags:'lake, nature',largeImageURL:'https://cdn.pixabay.com/large.jpg',previewURL:'https://cdn.pixabay.com/small.jpg',pageURL:'https://pixabay.com/photos/lake-4/',imageWidth:1920,imageHeight:1080,user:'Artist'}]};};
 const p={id:'pixabay',type:'pixabay',enabled:true},s={...defaults,tags:['lake']},key='PRIVATE_TEST_PIXABAY_KEY';let client=new ArtSources({request,now:()=>now});const images=await client.search(p,s,key,null,1,{dir});assert.equal(images[0].rating,'safe');assert.equal(images[0].attribution,'Artist');assert.equal(automaticSource(p),false);assert.equal(automaticSource({...p,type:'konachan'}),true);
 client=new ArtSources({request,now:()=>now});now+=23*60*60*1000;await client.search(p,s,key,null,1,{dir});assert.equal(calls,1);assert.equal((await client.search(p,s,key,null,2,{dir})).length,0);assert.equal(calls,1,'known last page does not send an invalid page request');assert(!(await fs.readFile(path.join(dir,'provider-cache.json'),'utf8')).includes(key));now+=60*60*1000+1;await client.search(p,s,key,null,1,{dir});assert.equal(calls,2);
});

test('DeviantArt client access renews, browses tags and resolves only permitted original downloads',async()=>{
 let now=100000,tokens=0;const queries=[],key=JSON.stringify({client_id:'123',client_secret:'PRIVATE_TEST_CLIENT_SECRET'}),client=new ArtSources({now:()=>now,request:async(url,signal,options={})=>{
  const u=new URL(url);if(u.pathname==='/oauth2/token'){tokens++;assert.equal(options.method,'POST');assert.equal(u.search,'');const form=new URLSearchParams(options.body);assert.equal(form.get('client_id'),'123');assert.equal(form.get('grant_type'),'client_credentials');assert.equal(form.has('scope'),false);return {access_token:'token-'+tokens,expires_in:3600};}
  assert.equal(options.headers.Authorization,'Bearer token-'+tokens);assert.equal(u.searchParams.has('access_token'),false);
  if(u.pathname.endsWith('/metadata'))return {metadata:[{deviationid:'abc',tags:[{tag_name:'landscape'},{tag_name:'forest'}]}]};
  if(u.pathname.includes('/download/'))return {src:'https://images-wixmp.com/original.jpg',filename:'original.jpg',width:2560,height:1440,filesize:4000};
  queries.push(u);return {has_more:true,results:[{deviationid:'abc',is_downloadable:true,is_mature:false,content:{src:'https://images-wixmp.com/view.jpg',width:1920,height:1080},thumbs:[{src:'https://images-wixmp.com/preview.jpg',width:300}],url:'https://www.deviantart.com/artist/art/abc',author:{username:'Artist'}},{deviationid:'locked',is_downloadable:false,content:{src:'https://images-wixmp.com/locked.jpg'}},{deviationid:'adult',is_downloadable:true,is_mature:true,content:{src:'https://images-wixmp.com/adult.jpg'}}]};
 }});
 const p={id:'art',type:'deviantart'},s={...defaults,tags:['mountain lake','forest']};const images=await client.search(p,s,key,null,1);assert.equal(images.length,1);assert.equal(images.hasMore,true);assert.equal(queries[0].searchParams.get('tag'),'mountainlake');await client.search(p,s,key,null,3);assert.equal(queries.at(-1).searchParams.get('offset'),'24');assert.equal(tokens,1);await client.enrich(images[0],key);assert.equal(images[0].url,'https://images-wixmp.com/original.jpg');assert.deepEqual(images[0].tags,['landscape','forest']);now+=3600000;await client.search(p,s,key,null,1);assert.equal(tokens,2);
});

test('invalid credentials and malformed sources fail explicitly; unsafe original URLs are rejected',async()=>{
 const p={id:'art',type:'deviantart'},s={...defaults,tags:['nature']};let client=new ArtSources({request:async()=>{throw Object.assign(new AppError('sourceUnavailable'),{status:403});}});await assert.rejects(client.search(p,s,'token',null),{code:'sourceAuthFailed'});await assert.rejects(client.search(p,s,'',null),{code:'apiKeyRequired'});
 client=new ArtSources({request:async()=>({hits:[{id:1,largeImageURL:'http://example.com/insecure.jpg'}]})});await assert.rejects(client.search({id:'pixabay',type:'pixabay'},s,'key',null),{code:'unsafeURL'});
 client=new ArtSources({request:async()=>({unexpected:true})});await assert.rejects(client.search({id:'konachan',type:'konachan'},s,null,null),{code:'invalidFeed'});
});
