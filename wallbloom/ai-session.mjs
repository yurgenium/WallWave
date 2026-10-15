import {fork} from 'node:child_process';
import os from 'node:os';
import {AppError} from './core.mjs';
// Reuse one model session across the whole download batch.
export class AISession{
 constructor(dir,{signal,mode='eco',onEvent=()=>{},allowed=()=>true}={}){
  this.closed=false;this.pending=null;this.next=0;this.ready=new Promise(resolve=>this.readyResolve=resolve);
  this.child=fork(new URL('./ai-worker.mjs',import.meta.url),[dir,'--service'],{env:{...process.env,WALLBLOOM_AI:mode},silent:true,windowsHide:true});
  this.child.stdout.resume();this.stderr='';this.child.stderr.on('data',b=>this.stderr=(this.stderr+b).slice(-4000));
  this.startup=setTimeout(()=>this.close('aiUnavailable'),30000);
  this.child.on('message',m=>{if(m.ready){clearTimeout(this.startup);this.readyResolve();}if(m.code)onEvent(m.code);if(this.pending&&m.request===this.pending.id){const p=this.pending;this.pending=null;clearTimeout(p.timer);if(m.error){this.stderr=(this.stderr+'\n'+(m.detail||'')).slice(-4000);p.reject(new AppError('aiUnavailable'));}else p.resolve(m);}});
  this.child.on('error',()=>this.close('aiUnavailable'));this.child.on('exit',()=>this.close('aiUnavailable'));
  this.abort=()=>this.close('aiPaused');this.signal=signal;signal?.addEventListener('abort',this.abort,{once:true});
  this.timer=setInterval(()=>{if(!allowed()||os.freemem()<2*1024**3)this.close('aiPaused');},1000);this.timer.unref();
  try{os.setPriority(this.child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}
  if(signal?.aborted)this.close('aiPaused');
 }
 async request(input){
  await this.ready;
  if(this.closed)return Promise.reject(new AppError(this.reason||'aiUnavailable'));
  if(this.pending)return Promise.reject(new AppError('busy'));
  return new Promise((resolve,reject)=>{const id=++this.next,timer=setTimeout(()=>this.close('aiPaused'),180000);this.pending={id,resolve,reject,timer};this.child.send({...input,request:id},error=>{if(error)this.close('aiUnavailable');});});
 }
 close(reason='aiPaused'){
  if(this.closed)return;this.closed=true;this.reason=reason;clearTimeout(this.startup);this.readyResolve();clearInterval(this.timer);this.signal?.removeEventListener('abort',this.abort);
  if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(new AppError(reason));this.pending=null;}
  this.child.kill();
 }
}
