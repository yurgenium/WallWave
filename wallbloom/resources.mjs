export function resourceAvailability({cpuLoad,gpuLoad},freeMemory,totalMemory){
 const minFree=Math.max(2*1024**3,totalMemory*.15);
 return {ready:cpuLoad<=40&&(gpuLoad==null||gpuLoad<=50)&&freeMemory>=minFree,cpuLoad,gpuLoad,freeMemory,minFree};
}

// A single CPU/GPU sample is not enough to interrupt a user's download batch.
export class ResourcePressureGuard{
 constructor(){this.reset();}
 reset(){this.busySince=null;this.recoverSince=null;this.blocked=false;}
 update(metrics,freeMemory,totalMemory,now=Date.now()){
  const sample=resourceAvailability(metrics,freeMemory,totalMemory);
  if(freeMemory<sample.minFree){this.blocked=true;this.busySince=null;this.recoverSince=null;}
  else if(!sample.ready){this.recoverSince=null;this.busySince??=now;if(now-this.busySince>=10000)this.blocked=true;}
  else{this.busySince=null;if(this.blocked){this.recoverSince??=now;if(now-this.recoverSince>=5000){this.blocked=false;this.recoverSince=null;}}}
  return {...sample,ready:!this.blocked};
 }
}
