export class ReviewState{
 constructor({send,changed=()=>{},failed=()=>{},delay=5000,now=Date.now,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
  Object.assign(this,{send,changed,failed,delay,now,setTimer,clearTimer});this.pending=new Map();this.saving=new Map();this.recent=[];this.versions=new Map();
 }
 touch(id){this.versions.set(id,(this.versions.get(id)||0)+1);this.changed(id);}
 version(id){return this.versions.get(id)||0;}
 remember(id){this.recent=[id,...this.recent.filter(x=>x!==id)].slice(0,3);}
 cancel(id){const p=this.pending.get(id);if(!p||p.committing)return false;this.clearTimer(p.timer);this.pending.delete(id);this.touch(id);return true;}
 async vote(value){
  const old=this.pending.get(value.id);if(old&&!old.committing){const same=old.vote===value.vote;this.cancel(value.id);if(same)return true;}
  const input={...value,reviewedAt:this.now()};if(input.vote!==null)this.remember(input.id);
  if(input.vote==='dislike'){
   const p={...input,until:this.now()+this.delay,committing:false};this.pending.set(input.id,p);
   p.timer=this.setTimer(()=>this.commit(input),this.delay);this.touch(input.id);return true;
  }
  return this.commit(input);
 }
 async commit(input){
  const p=this.pending.get(input.id),ownsPending=p?.reviewedAt===input.reviewedAt;if(ownsPending)p.committing=true;
  this.saving.set(input.id,input);this.touch(input.id);
  try{await this.send(input);return true;}catch(e){this.failed(e);return false;}
  finally{if(ownsPending&&this.pending.get(input.id)===p)this.pending.delete(input.id);if(this.saving.get(input.id)===input)this.saving.delete(input.id);this.touch(input.id);}
 }
}
