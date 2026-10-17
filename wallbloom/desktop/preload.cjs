const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wallwaveDesktop',{
 readClipboard:()=>navigator.userActivation.isActive?ipcRenderer.invoke('wallwave:read-clipboard'):Promise.reject(Error('User gesture required')),
 setShortcutCapture:active=>{if(typeof active==='boolean')ipcRenderer.send('wallwave:shortcut-capture',active);}
});
