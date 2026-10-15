import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,sharpModule} from './core.mjs';
import {initLibrary,imagePath} from './library.mjs';

for(const [screens,full] of [[2,false],[0,false],[2,true]])test(`rejecting the current wallpaper replaces only affected displays (${screens} monitors, full=${full}), even while paused`,{timeout:20000},async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-current-vote-'));
 const data=path.join(temp,'library'),fixture=path.join(temp,'native.json');
 const monitors=screens?[{id:'screen-a',width:800,height:600,wallpaper:''},{id:'screen-b',width:800,height:600,wallpaper:''}]:[];
 await fs.writeFile(fixture,JSON.stringify({monitors}));await initLibrary(data);
 const sharp=await sharpModule(),items=[];
 for(const [id,color]of [['current','#123456'],['other','#32aa21'],['spare','#cc5432']]){
  const item={id,title:id,provider:'local',rating:'safe',tags:[],vote:null,downloaded:true,width:800,height:600};
  const bytes=await sharp({create:{width:800,height:600,channels:3,background:color}}).jpeg().toBuffer();
  await fs.writeFile(imagePath(data,item),bytes);await fs.writeFile(path.join(data,'thumbnails',id+'.jpg'),bytes);items.push(item);
 }
 if(full){const padding=await fs.open(path.join(data,'quota-fixture.bin'),'w');try{await padding.truncate(110*1024**2);}finally{await padding.close();}}
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({settings:{...defaults,rotation:false,maxTotalGB:full?0.1:defaults.maxTotalGB},paused:true,providers:[{id:'local',type:'local',name:'Local',folder:temp,enabled:true}],items,pages:{},current:'current',monitorCurrent:screens?{'screen-a':'current','screen-b':'other'}:{},lastRefresh:0,lastRotation:0}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLBLOOM_PORT:'0',WALLBLOOM_DATA_DIR:data,WALLBLOOM_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});
 let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
 t.after(async()=>{if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(temp,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(stderr)));});
 const base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 const post=async(route,value)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallbloom-Token':state.token},body:JSON.stringify(value)});assert.equal(response.status,200,await response.text());for(let i=0;i<200;i++){state=await get();if(!state.job)return;await new Promise(r=>setTimeout(r,20));}throw Error('Job timeout');};
 const calls=async()=>{try{return(await fs.readFile(fixture+'.calls','utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code==='ENOENT')return[];throw e;}};
 await post('vote',{id:'current',vote:'ban'});
 assert.notEqual(screens?state.monitors[0].current:state.current,'current');
 assert.equal(state.items.find(x=>x.id==='current').vote,'ban');assert.equal(state.paused,true);assert.equal(state.settings.rotation,false);
 assert.equal((await calls()).length,1);if(screens){assert.equal(state.monitors[1].current,'other');assert.equal((await calls())[0].id,'screen-a');}
 const unused=state.items.find(x=>!x.vote&&x.id!==state.current&&!state.monitors.some(m=>m.current===x.id));
 if(unused){const count=(await calls()).length;await post('vote',{id:unused.id,vote:'ban'});assert.equal((await calls()).length,count);}
 await post('vote',{id:'current',vote:null});await post('apply',{id:'current'});
 const before=(await calls()).length;await post('vote',{id:'current',vote:'dislike'});
 assert.equal((await calls()).length-before,screens||1);
 assert.ok(state.monitors.every(m=>m.current!=='current'));assert.notEqual(state.current,'current');
 // With no remaining candidate, report the situation and preserve the saved rating.
 for(const item of state.items.filter(x=>!['ban','dislike'].includes(x.vote)))await post('vote',{id:item.id,vote:'ban'});
 assert.ok(state.events.some(x=>x.code==='noAvailableWallpaper'));
});
