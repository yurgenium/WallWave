import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='./windows.mjs'&&context.parentURL?.endsWith('/server.mjs'))return {url:new URL('./test-native.mjs',import.meta.url).href,shortCircuit:true};return next(specifier,context);}});
