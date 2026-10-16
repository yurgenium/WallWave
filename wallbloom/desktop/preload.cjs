const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wallwaveDesktop',{
 setShortcutCapture:active=>{if(typeof active==='boolean')ipcRenderer.send('wallwave:shortcut-capture',active);}
});
