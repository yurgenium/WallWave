// Keep approved metadata ahead of a small number of original-file transfers.
// All tasks settle before drain returns, including cancellation and failures.
export class DownloadQueue{
 constructor({run,signal,parallel=2,capacity=4,changed=()=>{}}){
  this.run=run;this.parallel=parallel;this.capacity=capacity;this.changed=changed;
  this.pending=[];this.active=0;this.waiters=new Set();this.failure=null;
  this.controller=new AbortController();this.signal=signal?AbortSignal.any([signal,this.controller.signal]):this.controller.signal;
  this.abort=()=>{this.pending=[];this.notify();};this.signal.addEventListener('abort',this.abort,{once:true});
 }
 get size(){return this.pending.length+this.active;}
 notify(){this.changed({ready:this.size,active:this.active});for(const wake of this.waiters)wake();this.waiters.clear();}
 wait(){return new Promise(resolve=>this.waiters.add(resolve));}
 async room(remaining){
  for(;;){
   if(this.failure)throw this.failure;this.signal.throwIfAborted();
   const count=remaining();if(count<=0)return false;
   if(this.size<Math.min(this.capacity,count))return true;
   await this.wait();
  }
 }
 push(value){
  this.signal.throwIfAborted();if(this.size>=this.capacity)throw Error('Download queue is full');
  this.pending.push(value);this.pump();
 }
 pump(){
  while(!this.signal.aborted&&this.active<this.parallel&&this.pending.length){
   const value=this.pending.shift();this.active++;
   Promise.resolve().then(()=>{this.signal.throwIfAborted();return this.run(value,this.signal);}).catch(error=>{
    this.failure??=error;this.controller.abort(error);
   }).finally(()=>{this.active--;this.pump();this.notify();});
  }
  this.notify();
 }
 async drain(){while(this.size)await this.wait();if(this.failure)throw this.failure;this.signal.throwIfAborted();}
 close(){this.controller.abort();this.signal.removeEventListener('abort',this.abort);}
}
