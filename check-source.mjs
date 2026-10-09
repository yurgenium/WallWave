import {searchProvider,enrich} from './providers.mjs';
import {defaults} from './core.mjs';
try{const items=await searchProvider({id:'wallhaven',type:'wallhaven'},{...defaults,tags:['nature']},null,AbortSignal.timeout(30000));console.log('Wallhaven API: '+items.length+' results');if(items.length){await enrich(items[0],null,AbortSignal.timeout(30000));console.log('Image metadata: '+items[0].tags.length+' tags; '+items[0].rating);}}catch(e){console.error('Wallhaven check failed: '+(e.code||e.name));process.exitCode=1;}
