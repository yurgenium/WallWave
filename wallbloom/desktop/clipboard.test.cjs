const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('clipboard bridge requires a current user gesture',async()=>{
 let bridge,reads=0;const navigator={userActivation:{isActive:false}},sandbox={navigator,require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>bridge=value},ipcRenderer:{send(){},invoke:async channel=>{assert.equal(channel,'wallwave:read-clipboard');reads++;return 'fixture';}}})};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'preload.cjs'),'utf8'),sandbox);
 await assert.rejects(bridge.readClipboard(),/User gesture required/);assert.equal(reads,0);navigator.userActivation.isActive=true;assert.equal(await bridge.readClipboard(),'fixture');assert.equal(reads,1);
});

test('clipboard IPC accepts only the focused application main frame and bounds its result',()=>{
 const handlers={},app={setName(){},setAppUserModelId(){},setPath(){},getPath(){return __dirname;},requestSingleInstanceLock(){return false;},quit(){}};
 const sandbox={require:id=>id==='electron'?{app,ipcMain:{on(){},handle:(name,fn)=>handlers[name]=fn},clipboard:{readText:()=> 'x'.repeat(5000)}}:require(id),__dirname,process:{env:{},execPath:process.execPath}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),sandbox);
 vm.runInContext("base='http://127.0.0.1:1';window={isFocused:()=>true,webContents:{mainFrame:{url:base+'/'}}};",sandbox);const webContents=vm.runInContext('window.webContents',sandbox),event={sender:webContents,senderFrame:webContents.mainFrame},read=handlers['wallwave:read-clipboard'];assert.equal(read(event).length,4097);
 assert.throws(()=>read({...event,sender:{}}),/Clipboard unavailable/);assert.throws(()=>read({...event,senderFrame:{url:webContents.mainFrame.url}}),/Clipboard unavailable/);vm.runInContext('window.isFocused=()=>false',sandbox);assert.throws(()=>read(event),/Clipboard unavailable/);
});
