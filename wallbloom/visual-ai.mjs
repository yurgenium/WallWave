import {createHash} from 'node:crypto';
import {cosine} from './core.mjs';
export const embeddingVersion=2;
export const validEmbedding=v=>Array.isArray(v)&&v.length===512&&v.every(Number.isFinite)&&v.some(n=>n!==0);
const examples=items=>items.filter(x=>['like','dislike'].includes(x.vote)&&x.embeddingVersion===embeddingVersion&&validEmbedding(x.embedding));
export function tasteSignature(items){return createHash('sha256').update(examples(items).map(x=>x.id+':'+x.vote).sort().join('|')).digest('hex').slice(0,20);}
function neighbors(embedding,samples,except){
 const top=vote=>samples.filter(x=>x.vote===vote&&x.id!==except).map(x=>cosine(embedding,x.embedding)).sort((a,b)=>b-a).slice(0,3);
 const likes=top('like'),dislikes=top('dislike'),mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
 return {margin:mean(likes)-mean(dislikes),similarity:Math.max(likes[0]??0,dislikes[0]??0)};
}
export function tasteProfile(items){
 const samples=examples(items),likes=samples.filter(x=>x.vote==='like'),dislikes=samples.filter(x=>x.vote==='dislike');
 const calibration=likes.map(x=>neighbors(x.embedding,samples,x.id).margin).filter(Number.isFinite).sort((a,b)=>a-b);
 return {samples,likes:likes.length,dislikes:dislikes.length,calibration,signature:tasteSignature(items)};
}
export function assessTaste(embedding,profile,mode='cautious'){
 const strict=mode==='strict',minimum=strict?3:5;
 if(!validEmbedding(embedding)||profile.likes<minimum||profile.dislikes<minimum)return {rejected:false,reason:'learning'};
 const {margin,similarity}=neighbors(embedding,profile.samples);
 const quantile=profile.calibration[Math.floor((profile.calibration.length-1)*(strict?.2:.05))];
 const threshold=Math.min(strict?-.015:-.06,quantile);
 return {rejected:similarity>=(strict?.55:.65)&&margin<threshold,reason:'evaluated',margin,similarity,threshold};
}
