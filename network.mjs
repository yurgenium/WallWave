import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import {AppError} from './core.mjs';
export function publicAddress(address){if(net.isIPv4(address)){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224);}return !(/^(::|fc|fd|fe[89ab]|ff)/i.test(address)||address.includes('.')||/^2001:db8:/i.test(address));}
export async function checkURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw new AppError('unsafeURL');const addresses=await dns.lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw new AppError('unsafeURL');return u;}
export async function fetchBytes(url,{limit=30*1024**2,signal,onProgress}={}){let current=new URL(url);const timeout=AbortSignal.timeout(180000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;let response;
 // Pin the checked address to the connection to prevent DNS rebinding.
 for(let i=0;i<4;i++){current=await checkURL(current);const addresses=await dns.lookup(current.hostname.replace(/^\[|\]$/g,''),{all:true});if(addresses.some(a=>!publicAddress(a.address)))throw new AppError('unsafeURL');const address=addresses.find(a=>a.family===4)||addresses[0];response=await new Promise((resolve,reject)=>{const request=https.get(current,{signal:combined,headers:{'User-Agent':'Wallbloom/0.1'},lookup:(hostname,options,callback)=>options.all?callback(null,[address]):callback(null,address.address,address.family)},resolve);request.on('error',reject);});if([301,302,303,307,308].includes(response.statusCode)){response.destroy();current=new URL(response.headers.location,current);continue;}break;}
 if(!response||response.statusCode<200||response.statusCode>=300){response?.destroy();throw new AppError(response?.statusCode===429?'rateLimited':'sourceUnavailable');}
 const total=Number(response.headers['content-length'])||0;if(total>limit){response.destroy();throw new AppError('itemLimit');}const chunks=[];let size=0;for await(const chunk of response){combined.throwIfAborted();size+=chunk.length;if(size>limit){response.destroy();throw new AppError('itemLimit');}chunks.push(chunk);onProgress?.(size,total);}return Buffer.concat(chunks);
}
export async function fetchJSON(url,signal){const bytes=await fetchBytes(url,{limit:2*1024**2,signal});try{return JSON.parse(bytes.toString());}catch{throw new AppError('invalidFeed');}}
