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
contextBridge.exposeInMainWorld('wallwaveDesktop',{
 readClipboard:()=>{
  if(!pasteClick)return Promise.reject(Error('Paste button gesture required'));
  pasteClick=false;clearTimeout(pasteExpiry);
  return ipcRenderer.invoke('wallwave:read-clipboard');
 },
 setShortcutCapture:active=>{if(typeof active==='boolean')ipcRenderer.send('wallwave:shortcut-capture',active);}
});
