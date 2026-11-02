import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import net from 'node:net';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {defaults} from '../core.mjs';
const fixture=await fs.mkdtemp(path.join(os.tmpdir(),'wallwave-deployment-')),downloads=path.join(fixture,'Загрузки'),parent=path.join(fixture,'Папка с пробелами'),home=path.join(fixture,'profile'),installed=path.join(parent,'WallWave');
await fs.mkdir(downloads);await fs.mkdir(parent);await fs.mkdir(path.join(home,'library'),{recursive:true});
await fs.writeFile(path.join(home,'library','state.json'),JSON.stringify({settings:defaults,providers:[],items:[],pages:{},current:null,paused:true,lastRefresh:0,lastRotation:0}));
const exe=path.join(downloads,'WallWave-release.exe');await fs.copyFile(path.resolve(process.argv[2]),exe);
const environment={...process.env,WALLWAVE_DESKTOP_TEST:'1',WALLWAVE_DESKTOP_TEST_HOME:home};delete environment.WALLWAVE_TEST_INSTALL_PARENT;delete environment.WALLWAVE_DATA_DIR;
// The check runs a real launcher: stop at once if it reaches the user's own installation.
const realConfig=path.join(process.env.APPDATA||'',  'Wallbloom','installation.ini'),configStamp=async()=>(await fs.stat(realConfig).catch(()=>null))?.mtimeMs??null,realConfigBefore=await configStamp();
const assertRealInstallUntouched=async()=>assert.equal(await configStamp(),realConfigBefore,'launcher reached the real installation: '+realConfig);
let child,ready;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(file,select){
 await fs.rm(path.join(home,'library','desktop-test-ready.json'),{force:true});ready=null;
 const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
 child=spawn(file,['--hidden',`--inspect=${port}`],{windowsHide:true,stdio:'ignore',env:{...environment,...select&&{WALLWAVE_TEST_INSTALL_PARENT:select}}});
 await pause(1000);await assertRealInstallUntouched();for(let i=0;i<180;i++){try{ready=JSON.parse(await fs.readFile(path.join(home,'library','desktop-test-ready.json'),'utf8'));break;}catch{}if(child.exitCode!==null&&child.exitCode!==0)throw Error('launcher exited: '+child.exitCode);await pause(500);}
 assert.ok(ready,'application did not start');const state=await(await fetch(ready.base+'/api/state')).json();assert.equal(state.library,path.join(home,'library'));assert.equal(state.paused,true);
 for(let i=0;i<20&&child.exitCode===null;i++)await pause(250);assert.equal(child.exitCode,0,'launcher must close while the application is still running');process.kill(ready.pid,0);
 const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json(),ws=new WebSocket(targets[0].webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('quit timeout')),5000);ws.addEventListener('message',event=>{const result=JSON.parse(event.data);if(result.id===1){clearTimeout(timer);result.result?.exceptionDetails?reject(Error(JSON.stringify(result))):resolve();}});});ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'void globalThis.__wallwaveTest.beginQuit()'}}));await response;ws.close();
 const alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};for(let i=0;i<60&&(alive(ready.pid)||alive(ready.servicePid));i++)await pause(250);assert.equal(alive(ready.pid),false,'application did not quit');assert.equal(alive(ready.servicePid),false,'service did not quit');child=null;ready=null;
}
try {
 // A silent first launch cannot bypass the mandatory selection of a destination.
 child=spawn(exe,['/S'],{windowsHide:true,stdio:'ignore',env:environment});const exit=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('silent launcher timeout')),10000);child.once('exit',code=>{clearTimeout(timer);resolve(code);});});assert.equal(exit,2);child=null;assert.deepEqual(await fs.readdir(parent),[]);
 await launch(exe,parent);assert.deepEqual((await fs.readdir(downloads)).sort(),[path.basename(exe)]);const config=await fs.readFile(path.join(home,'installation.ini'));assert.ok(config.toString(config[0]===255&&config[1]===254?'utf16le':'utf8').includes(installed));
 assert.deepEqual((await fs.readdir(installed)).sort(),['LICENSE','README.md','WallWave.exe','app','installation.ini']);assert.equal((await fs.stat(path.join(installed,'WallWave.exe'))).isFile(),true);const version=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8')).version,runtime=path.join(installed,'app',version);await fs.access(path.join(runtime,'WallWave.exe'));const archive=path.join(runtime,'resources','app.asar'),mtime=(await fs.stat(archive)).mtimeMs;
 // Old unpacked versions are removed after a start; newer ones and the two closest older ones stay.
 const appFolder=path.join(installed,'app'),fakeVersions=['0.0.1','0.0.2','0.0.3','999.0.0'];for(const name of fakeVersions){await fs.mkdir(path.join(appFolder,name,'resources'),{recursive:true});await fs.writeFile(path.join(appFolder,name,'resources','app.asar'),'old');}
 await launch(exe);assert.equal((await fs.stat(archive)).mtimeMs,mtime,'subsequent launch must reuse extracted files');
 assert.deepEqual((await fs.readdir(appFolder)).sort(),['0.0.2','0.0.3',version,'999.0.0'].sort(),'only stale versions are removed');await fs.rm(path.join(appFolder,'999.0.0'),{recursive:true});
 // --quit closes a running copy through the normal shutdown path.
 {await fs.rm(path.join(home,'library','desktop-test-ready.json'),{force:true});child=spawn(exe,['--hidden'],{windowsHide:true,stdio:'ignore',env:environment});let started=null;for(let i=0;i<180&&!started;i++){try{started=JSON.parse(await fs.readFile(path.join(home,'library','desktop-test-ready.json'),'utf8'));}catch{await pause(500);}}assert.ok(started,'application did not start before --quit');ready=started;
  const quitter=spawn(path.join(installed,'WallWave.exe'),['--quit'],{windowsHide:true,stdio:'ignore',env:environment});await new Promise(resolve=>quitter.once('exit',resolve));
  const running=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};for(let i=0;i<80&&(running(ready.pid)||running(ready.servicePid));i++)await pause(250);assert.equal(running(ready.pid),false,'--quit did not close the application');assert.equal(running(ready.servicePid),false,'--quit did not close the service');ready=null;child=null;
  // With nothing running, --quit starts nothing and changes nothing.
  await fs.rm(path.join(home,'library','desktop-test-ready.json'),{force:true});const idle=spawn(runtime+'\\WallWave.exe',['--quit'],{windowsHide:true,stdio:'ignore',env:environment});await new Promise(resolve=>idle.once('exit',resolve));await pause(1500);await assert.rejects(fs.stat(path.join(home,'library','desktop-test-ready.json')),'--quit must not start the application');}
 // An older EXE must keep a newer installation and start it instead of rolling back.
 {const newer=path.join(appFolder,'999.0.0'),iniFile=path.join(installed,'installation.ini'),launcherTime=(await fs.stat(path.join(installed,'WallWave.exe'))).mtimeMs;await fs.cp(runtime,newer,{recursive:true});await fs.writeFile(iniFile,Buffer.concat([Buffer.from([255,254]),Buffer.from('[WallWave]\r\nProduct=app.wallbloom.desktop\r\nVersion=999.0.0\r\nRuntime=app\\999.0.0\r\n','utf16le')]));
  await launch(exe);const after=await fs.readFile(iniFile);assert.ok(after.toString('utf16le').includes('Version=999.0.0'),'older EXE rewrote the installed version');assert.equal((await fs.stat(path.join(installed,'WallWave.exe'))).mtimeMs,launcherTime,'older EXE replaced the installed launcher');await fs.rm(newer,{recursive:true});await fs.writeFile(iniFile,Buffer.concat([Buffer.from([255,254]),Buffer.from('[WallWave]\r\nProduct=app.wallbloom.desktop\r\nVersion='+version+'\r\nRuntime=app\\'+version+'\r\n','utf16le')]));}
 await fs.rm(path.join(home,'installation.ini'));await launch(path.join(installed,'WallWave.exe'));assert.equal((await fs.stat(archive)).mtimeMs,mtime);
 console.log('PASS: launcher exits while app keeps running; first launch requires a destination; forced WallWave folder, Cyrillic/spaces, clean Downloads, remembered location, installed launcher, persistent settings, no repeated extraction, old versions pruned, --quit, and no rollback by an older EXE.');
} finally {
 if(ready)for(const pid of [ready.pid,ready.servicePid])try{process.kill(pid);}catch{}if(child?.exitCode===null)child.kill();await pause(500);
 // All test-created files stay inside this resolved temporary fixture.
 assert.ok(fixture.startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(fixture,{recursive:true,force:true,maxRetries:20,retryDelay:500}).catch(error=>console.error('Temporary files left behind: '+error.code));
}
