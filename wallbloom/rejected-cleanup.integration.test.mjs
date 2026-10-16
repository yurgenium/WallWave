import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fork} from 'node:child_process';
import {defaults} from './core.mjs';
import {initLibrary,imagePath} from './library.mjs';
test('background timer clears expired negative files without another rating or wallpaper change',{timeout:40000},async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-expired-votes-')),data=path.join(dir,'library'),fixture=path.join(dir,'native.json');await initLibrary(data);await fs.writeFile(fixture,'{}');
 // Leave time for the child process to start before expiry; the 15-second tick
 // must perform the cleanup, rather than the startup cleanup winning the race.
 const items=['ban','dislike','like'].map((vote,i)=>({id:'item'+i,vote,downloaded:true,provider:'local',tags:[],rating:'safe',visualHash:'0123456789abcdef',rejectedAt:Date.now()-290000,hash:'hash'+i}));for(const item of items)await fs.writeFile(imagePath(data,item),'cached');
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({settings:{...defaults,ai:'off',autoRefresh:false,rotation:false},items,providers:[{id:'local',name:'Local',type:'local',folder:dir,enabled:true}],pages:{},recentReviews:items.map(item=>({id:item.id,time:item.rejectedAt}))}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture,WALLBLOOM_PORT:'0'},silent:true,windowsHide:true});child.stdout.resume();child.stderr.resume();
 t.after(async()=>{if(child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await ended;}await fs.rm(dir,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',message=>message.type==='ready'&&resolve(message.port));child.once('exit',()=>reject(Error('Service exited')));}),get=async()=>await(await fetch('http://127.0.0.1:'+port+'/api/state')).json();
 let state=await get();assert(state.items.find(item=>item.id==='item0').downloaded);const deadline=Date.now()+32000;while(Date.now()<deadline){state=await get();if(state.items.filter(item=>['ban','dislike'].includes(item.vote)).every(item=>!item.downloaded)&&!state.job)break;await new Promise(resolve=>setTimeout(resolve,100));}
 for(const item of items.slice(0,2)){await assert.rejects(fs.access(imagePath(data,item)));const stored=state.items.find(row=>row.id===item.id);assert.equal(stored.vote,item.vote);assert.equal(stored.hash,item.hash);}await fs.access(imagePath(data,items[2]));
});
