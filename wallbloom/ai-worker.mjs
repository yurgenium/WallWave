import fs from 'node:fs/promises';
import path from 'node:path';
import {sharpModule} from './core.mjs';
const dir=process.argv[2];const items=JSON.parse(await fs.readFile(path.join(dir,'ai-input.json'),'utf8'));
const {env,AutoProcessor,CLIPVisionModelWithProjection,RawImage}=await import('@huggingface/transformers');
env.cacheDir=path.join(dir,'models');env.allowLocalModels=false;const threads=process.env.WALLBLOOM_AI==='eco'?1:2;env.backends.onnx.wasm.numThreads=threads;
const modelId='Xenova/clip-vit-base-patch32';
process.send?.({code:'modelLoading'});
const processor=await AutoProcessor.from_pretrained(modelId);const model=await CLIPVisionModelWithProjection.from_pretrained(modelId,{dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:threads,interOpNumThreads:1}});
try{const sharp=await sharpModule();sharp.concurrency(1);for(const item of items){const {data,info}=await sharp(path.join(dir,'thumbnails',item.id+'.jpg')).removeAlpha().raw().toBuffer({resolveWithObject:true});const inputs=await processor(new RawImage(new Uint8Array(data),info.width,info.height,info.channels));const output=await model(inputs);process.send?.({id:item.id,embedding:Array.from(output.image_embeds.data)});}}finally{await model.dispose();}
