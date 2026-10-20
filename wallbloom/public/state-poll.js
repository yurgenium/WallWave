// Periodic reads share one request. A mutation can require a fresh read after it.
export function createStatePoller({read,apply,failed}){
 let active=null,again=false;
 return function poll(fresh=false){
  if(active){if(fresh)again=true;return active;}
  active=(async()=>{
   do{
    again=false;
    try{const next=await read();if(!again)apply(next);}
    catch(error){if(!again)failed(error);}
   }while(again);
  })().finally(()=>{active=null;});
  return active;
 };
}
