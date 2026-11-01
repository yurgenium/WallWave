import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {defaults,validate,sharpModule} from './core.mjs';
import {initLibrary,imagePath} from './library.mjs';
import {sharedEligible} from './automation.mjs';
import {monitorLayout} from './public/monitor-layout.js';

const monitor=(purity,inheritPurity=false)=>({rotation:false,rotationMinutes:60,purity,tags:[],inheritPurity});

test('monitor mode is validated and defaults to separate wallpapers',()=>{
 assert.equal(validate(defaults).monitorMode,'separate');
 assert.equal(validate({...defaults,monitorMode:'same'}).monitorMode,'same');
 assert.throws(()=>validate({...defaults,monitorMode:'mirror'}),{code:'invalidSettings'});
});

test('shared candidates satisfy every monitor filter',()=>{
 const items=[{id:'calm',rating:'safe'},{id:'bold',rating:'suggestive'}].map(x=>({...x,downloaded:true,tags:[],vote:'like'}));
 const db={settings:{...defaults,purity:'110'},items,providers:[]};
 const both={...db.settings,purity:'110'},safe={...db.settings,purity:'100'};
 assert.deepEqual([...sharedEligible(db,[both,both])].sort(),['bold','calm']);
 assert.deepEqual([...sharedEligible(db,[both,safe])],['calm']);
 assert.deepEqual([...sharedEligible(db,[])],[]);
});

test('layout keeps relative positions, sizes and orientation',()=>{
 const {width,height,boxes}=monitorLayout([{id:'a',width:2560,height:1440,left:0,top:0},{id:'b',width:1080,height:1920,left:2560,top:-240}]);
 assert.equal(width,3640);assert.equal(height,1920);
 assert.ok(boxes[1].height>boxes[0].height&&boxes[1].width<boxes[0].width,'portrait screen is taller and narrower');
 assert.equal(Math.round(boxes[0].top*height/100),240);assert.equal(Math.round(boxes[1].left*width/100),2560);
 const fallback=monitorLayout([{id:'a',width:100,height:100},{id:'b',width:100,height:100}]).boxes;
 assert.equal(fallback[1].left,50,'monitors without coordinates are placed side by side');
});

test('"same on all screens" applies one allowed image everywhere and ignores per-monitor timers',{timeout:20000},async t=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-monitor-mode-'));
 const data=path.join(temp,'library'),fixture=path.join(temp,'native.json');
 const monitors=[{id:'screen-a',width:800,height:600,left:0,top:0,wallpaper:''},{id:'screen-b',width:600,height:800,left:800,top:0,wallpaper:''}];
 await fs.writeFile(fixture,JSON.stringify({monitors}));await initLibrary(data);
 const sharp=await sharpModule(),items=[];
 for(const [id,rating,color]of [['calm','safe','#123456'],['bold','suggestive','#cc5432'],['quiet','safe','#32aa21']]){
  const item={id,title:id,provider:'local',rating,tags:[],vote:'like',downloaded:true,width:800,height:600};
  const bytes=await sharp({create:{width:800,height:600,channels:3,background:color}}).jpeg().toBuffer();
  await fs.writeFile(imagePath(data,item),bytes);await fs.writeFile(path.join(data,'thumbnails',id+'.jpg'),bytes);items.push(item);
 }
 // Screen B only accepts SFW; the global filter allows SFW and Sketchy.
 const settings={...defaults,purity:'110',monitorMode:'same',rotation:false,monitors:{'screen-a':monitor('110'),'screen-b':{...monitor('100'),rotation:true,rotationMinutes:1}}};
 await fs.writeFile(path.join(data,'state.json'),JSON.stringify({settings,providers:[{id:'local',type:'local',name:'Local',folder:temp,enabled:true}],items,pages:{},current:null,monitorCurrent:{},lastRefresh:0,lastRotation:0}));
 const child=fork(new URL('./server.mjs',import.meta.url),[],{execArgv:['--import',new URL('./tools/test-native-loader.mjs',import.meta.url).href],env:{...process.env,WALLWAVE_PORT:'0',WALLWAVE_DATA_DIR:data,WALLWAVE_NATIVE_FIXTURE:fixture},silent:true,windowsHide:true});
 let stderr='';child.stderr.on('data',b=>stderr+=b);child.stdout.resume();
 t.after(async()=>{if(child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.send({type:'shutdown'});await ended;}await fs.rm(temp,{recursive:true,force:true});});
 const port=await new Promise((resolve,reject)=>{child.on('message',m=>m.type==='ready'&&resolve(m.port));child.once('exit',()=>reject(Error(stderr)));});
 const base='http://127.0.0.1:'+port,get=async()=>await(await fetch(base+'/api/state')).json();let state=await get();
 const idle=async()=>{for(let i=0;i<300;i++){state=await get();if(!state.job&&!state.wallpaperAction)return;await new Promise(r=>setTimeout(r,20));}throw Error('Job timeout');};
 const post=async(route,value)=>{const response=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Wallwave-Token':state.token},body:JSON.stringify(value)});assert.equal(response.status,200,await response.text());await idle();};
 assert.equal(state.settings.monitorMode,'same');
 for(let round=0;round<3;round++){
  await post('next',{});
  const [a,b]=state.monitors.map(m=>m.current);
  assert.ok(a,'a wallpaper was applied');assert.equal(a,b,'both screens show the same image');
  assert.notEqual(a,'bold','an image blocked on one screen is never chosen for all screens');
 }
 // A manual choice of one screen still works in this mode.
 await post('apply',{id:'calm',monitorId:'screen-b'});
 assert.equal(state.monitors.find(m=>m.id==='screen-b').current,'calm');
 // Switching back restores independent choices.
 await post('settings',{...state.settings,monitorMode:'separate'});
 assert.equal(state.settings.monitorMode,'separate');
});
