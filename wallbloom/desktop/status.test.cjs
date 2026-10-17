const test=require('node:test'),assert=require('node:assert/strict');
const {status}=require('./status.cjs');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('tray locks mutations during archives and rebuilds between busy operation kinds',()=>{
 const app={setName(){},setAppUserModelId(){},setPath(){},getPath(){return __dirname;},getAppPath(){return path.resolve(__dirname,'..');},getLoginItemSettings(){return {openAtLogin:false};},requestSingleInstanceLock(){return false;},quit(){}};
 const electron={app,ipcMain:{on(){},handle(){}},nativeImage:{createFromPath:file=>file},Menu:{buildFromTemplate:items=>items}};
 const sandbox={require:id=>id==='electron'?electron:require(id),__dirname,process:{env:{},execPath:process.execPath}};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),sandbox);
 vm.runInContext(`base='http://127.0.0.1:1';tray={setImage(){},setToolTip(){},setContextMenu(){}};
 snapshot={settings:{language:'en',ai:'off'},guard:{code:'active'},current:'wallpaper',job:{kind:'refresh'}};updateTray();`,sandbox);
 const menu=()=>vm.runInContext('nativeMenu',sandbox);
 const enabled=id=>menu().find(item=>item.id===id).enabled;
 assert.equal(enabled('like'),true);assert.equal(enabled('refresh'),false);
 for(const kind of ['export','import']){
  vm.runInContext(`snapshot.job={kind:'${kind}'};updateTray();`,sandbox);
  for(const id of ['next','like','ban','work'])assert.equal(enabled(id),false,`${id} locked during ${kind}`);
 }
 vm.runInContext('snapshot.job=null;updateTray();',sandbox);
 for(const id of ['next','like','ban','work','refresh'])assert.equal(enabled(id),true,`${id} unlocked after archive`);
});
test('tray shows paused, working, error and idle waiting states',()=>{const base={settings:{autoRefresh:true,rotation:false,ai:'off'},guard:{code:'active'},paused:false,job:null,lastError:null};assert.equal(status(null),'starting');assert.equal(status(base),'waiting');assert.equal(status({...base,guard:{code:'idle'}}),'ready');assert.equal(status({...base,job:{kind:'refresh'}}),'working');assert.equal(status({...base,lastError:{code:'networkError'}}),'error');assert.equal(status({...base,paused:true,job:{kind:'refresh'},lastError:{code:'timeout'}}),'paused');});
