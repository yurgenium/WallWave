import {AppError} from './core.mjs';
import {searchProvider,validateProvider} from './providers.mjs';
import {fetchBytes} from './network.mjs';

export async function checkSource(provider,settings,key,{signal,search=searchProvider,bytes=fetchBytes}={}){
 const p=validateProvider({...provider,id:provider.id||'connection-check',enabled:true});
 // This only probes the source. It does not save, rate, train on or install an image.
 const list=await search(p,{...settings,tags:['landscape'],excludedTags:[],purity:'100'},key,signal,1);
 if(!list.length)return {ok:true,count:0,preview:false};
 const item=list.find(x=>x.preview)||list[0];if(!item.preview&&!item.url)throw new AppError('invalidFeed');
 const data=await bytes(item.preview||item.url,{signal,prefix:1024,limit:1024*1024,attempts:1,timeoutMs:10000,category:'preview'});
 return {ok:true,count:list.length,preview:data.length>0};
}
