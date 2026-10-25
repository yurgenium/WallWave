const {contextBridge,ipcRenderer}=require('electron');
// Authorize one read from an actual paste-button click. Native window focus can
// lag behind the click when returning from another application on Windows.
let pasteClick=false,pasteExpiry;
window.addEventListener('click',event=>{
 const button=event.target?.closest?.('button[data-clipboard-paste]');
 if(!event.isTrusted||!button||button.disabled)return;
 clearTimeout(pasteExpiry);pasteClick=true;
 pasteExpiry=setTimeout(()=>{pasteClick=false;},0);
},true);
let panelListener,pendingPanel;ipcRenderer.on('wallwave:open-panel',(_,panel)=>{if(panel!=='hold')return;if(panelListener)panelListener(panel);else pendingPanel=panel;});
contextBridge.exposeInMainWorld('wallwaveDesktop',{
 openLogs:()=>ipcRenderer.invoke('wallwave:open-logs'),
 saveDiagnostics:()=>ipcRenderer.invoke('wallwave:save-diagnostics'),
 onOpenPanel:listener=>{if(typeof listener!=='function')return;panelListener=listener;if(pendingPanel){const panel=pendingPanel;pendingPanel=null;listener(panel);}},
 readClipboard:()=>{
  if(!pasteClick)return Promise.reject(Error('Paste button gesture required'));
  pasteClick=false;clearTimeout(pasteExpiry);
  return ipcRenderer.invoke('wallwave:read-clipboard');
 },
 setShortcutCapture:active=>{if(typeof active==='boolean')ipcRenderer.send('wallwave:shortcut-capture',active);}
});
