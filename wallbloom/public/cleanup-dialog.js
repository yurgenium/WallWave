export function createCleanupDialog({t}){
 const dialog=document.createElement('dialog');dialog.id='cleanupDialog';dialog.className='cleanup-dialog';
 const title=document.createElement('h2'),description=document.createElement('p'),detail=document.createElement('p'),notice=document.createElement('p'),error=document.createElement('p'),actions=document.createElement('div');
 title.id='cleanupTitle';dialog.setAttribute('aria-labelledby',title.id);description.id='cleanupDescription';dialog.setAttribute('aria-describedby',description.id);detail.className=notice.className='muted';error.className='cleanup-error';error.setAttribute('role','alert');actions.className='cleanup-actions';
 const no=document.createElement('button'),yes=document.createElement('button');no.type=yes.type='button';no.dataset.cleanupAnswer='no';yes.dataset.cleanupAnswer='yes';yes.className='danger';actions.append(no,yes);dialog.append(title,description,detail,notice,error,actions);document.body.append(dialog);
 let cancelCurrent=null;
 dialog.addEventListener('keydown',e=>e.stopPropagation());
 return async({count,label,waitMs=3000,onConfirm})=>{
  if(cancelCurrent)cancelCurrent();
  title.textContent=t('cleanupConfirmTitle');description.textContent=t('cleanupConfirmText');detail.textContent=`${label} · ${t('cleanupCount')}: ${count}`;notice.textContent=t('cleanupPreserve');no.textContent=t('cleanupNo');error.textContent='';no.disabled=false;
  const deadline=performance.now()+Math.max(3000,waitMs);let busy=false;
  const update=()=>{const seconds=Math.max(0,Math.ceil((deadline-performance.now())/1000));yes.disabled=busy||seconds>0||count===0;yes.textContent=t('cleanupYes')+(seconds?` (${seconds})`:'');};update();
  return new Promise(resolve=>{
   const interval=setInterval(update,50);
   const finish=value=>{clearInterval(interval);cancelCurrent=null;dialog.oncancel=null;no.onclick=yes.onclick=null;dialog.close();resolve(value);};
   cancelCurrent=()=>finish(false);no.onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();if(!busy)finish(false);};
   yes.onclick=async()=>{if(yes.disabled||busy||performance.now()<deadline)return;busy=true;no.disabled=true;update();error.textContent='';try{await onConfirm();finish(true);}catch(e){error.textContent=e.message;busy=false;no.disabled=false;update();}};
   dialog.showModal();no.focus();
  });
 };
}
