// Read-only inspection of a test-mode Electron process; optional --open recreates its test window.
const port=Number(process.argv[2]);const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();const target=targets.find(t=>t.type==='node');if(!target)throw Error('No test inspector');
const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
const timer=setTimeout(()=>{console.log('Inspector response timeout');ws.close();},5000);
const read=function(){const t=globalThis.__wallbloomTest;if(!t)return {testMode:false};const s=t.getSnapshot();return {testMode:true,paused:s.paused,job:s.job,menu:t.getMenu().items.map(x=>({label:x.label,enabled:x.enabled})),openEnabled:t.getMenu().getMenuItemById('open').enabled};};
const expression=process.argv.includes('--open')?'globalThis.__wallbloomTest?.openWindow();('+read.toString()+')()':'('+read.toString()+')()';
ws.addEventListener('message',event=>{const result=JSON.parse(event.data);if(result.id===1){console.log(JSON.stringify(result.result||result.error));clearTimeout(timer);ws.close();}});
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
