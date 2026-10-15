import {registerHooks} from 'node:module';
import os from 'node:os';
// CLIP is a fixture in this process: give its resource gate a deterministic
// budget too, rather than depending on the RAM of the CI runner or developer PC.
os.totalmem=()=>16*1024**3;
os.freemem=()=>8*1024**3;
registerHooks({resolve(specifier,context,next){if(specifier==='./ai-session.mjs'&&context.parentURL?.endsWith('/server.mjs'))return {url:new URL('./test-ai.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
