import fs from 'node:fs/promises';
const file=process.env.WALLBLOOM_NATIVE_FIXTURE;
export async function activity(){return {supported:true,idle:0,fullscreen:false,onBattery:false,processes:[],...(JSON.parse(await fs.readFile(file,'utf8')).activity||{})};}
export async function desktopInfo(){return {width:800,height:600,wallpaper:''};}
export async function listMonitors(){return JSON.parse(await fs.readFile(file,'utf8')).monitors||[{id:'screen-a',width:800,height:600,wallpaper:'',left:0,top:0},{id:'screen-b',width:600,height:800,wallpaper:'',left:800,top:0}];}
export async function applyWallpaper(image){await fs.appendFile(file+'.calls',JSON.stringify({image})+'\n');}
export async function applyMonitor(image,id){const delay=JSON.parse(await fs.readFile(file,'utf8')).applyDelay;if(delay)await new Promise(r=>setTimeout(r,delay));await fs.appendFile(file+'.calls',JSON.stringify({image,id})+'\n');}
export async function openWallhavenAccount(){}
