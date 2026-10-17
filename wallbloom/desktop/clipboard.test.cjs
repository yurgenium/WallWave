const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('clipboard bridge accepts one read per trusted paste-button click, including keyboard clicks',async()=>{
 let bridge,click,expiry,reads=0;
 const sandbox={window:{addEventListener:(name,fn,capture)=>{assert.equal(name,'click');assert.equal(capture,true);click=fn;}},setTimeout:fn=>{expiry=fn;return 1;},clearTimeout:()=>{},require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>bridge=value},ipcRenderer:{send(){},invoke:async channel=>{assert.equal(channel,'wallwave:read-clipboard');reads++;return 'fixture';}}})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'preload.cjs'),'utf8'),sandbox);
 const reject=()=>assert.rejects(bridge.readClipboard(),/Paste button gesture required/);
 const gesture=(isTrusted=true,button={disabled:false})=>click({isTrusted,target:{closest:selector=>{assert.equal(selector,'button[data-clipboard-paste]');return button;}}});
 await reject();gesture(false);await reject();gesture(true,null);await reject();gesture(true,{disabled:true});await reject();assert.equal(reads,0);
 gesture();assert.equal(await bridge.readClipboard(),'fixture');await reject();assert.equal(reads,1);
 gesture();expiry();await reject();assert.equal(reads,1);
 gesture();assert.equal(await bridge.readClipboard(),'fixture');assert.equal(reads,2);
});

test('clipboard IPC accepts only the application main frame and bounds its result despite native focus lag',()=>{
 const handlers={},app={setName(){},setAppUserModelId(){},setPath(){},getPath(){return __dirname;},requestSingleInstanceLock(){return false;},quit(){}};
 const sandbox={require:id=>id==='electron'?{app,ipcMain:{on(){},handle:(name,fn)=>handlers[name]=fn},clipboard:{readText:()=> 'x'.repeat(5000)}}:require(id),__dirname,process:{env:{},execPath:process.execPath}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'main.cjs'),'utf8'),sandbox);
 vm.runInContext("base='http://127.0.0.1:1';window={isFocused:()=>false,webContents:{mainFrame:{url:base+'/'}}};",sandbox);const webContents=vm.runInContext('window.webContents',sandbox),event={sender:webContents,senderFrame:webContents.mainFrame},read=handlers['wallwave:read-clipboard'];assert.equal(read(event).length,4097);
 assert.throws(()=>read({...event,sender:{}}),/Clipboard unavailable/);assert.throws(()=>read({...event,senderFrame:{url:webContents.mainFrame.url}}),/Clipboard unavailable/);
 vm.runInContext("window.webContents.mainFrame.url=base+'/other';",sandbox);assert.throws(()=>read(event),/Clipboard unavailable/);
 vm.runInContext('window=null',sandbox);assert.throws(()=>read(event),/Clipboard unavailable/);
});
