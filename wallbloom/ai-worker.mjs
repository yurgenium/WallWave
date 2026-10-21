import fs from 'node:fs/promises';
import path from 'node:path';
import {sharpModule} from './core.mjs';
import {embeddingVersion,validEmbedding} from './visual-ai.mjs';
const dir=process.argv[2];
const {env,AutoProcessor,CLIPVisionModelWithProjection,RawImage}=await import('@huggingface/transformers');
env.cacheDir=process.env.WALLWAVE_MODEL_CACHE||path.join(dir,'models');env.allowLocalModels=false;
const threads=process.env.WALLBLOOM_AI==='eco'?1:2;
env.backends.onnx.wasm.numThreads=threads;
const modelId='Xenova/clip-vit-base-patch32';
const cachedFiles=await Promise.all(['config.json','preprocessor_config.json','onnx/vision_model_quantized.onnx'].map(async file=>{try{return (await fs.stat(path.join(env.cacheDir,modelId,file))).size>0;}catch{return false;}}));
const offline={local_files_only:process.env.WALLWAVE_AI_OFFLINE==='1'||cachedFiles.every(Boolean)};
if(offline.local_files_only){env.allowLocalModels=true;env.localModelPath=env.cacheDir;env.allowRemoteModels=false;}
const options={...offline,dtype:'q8',device:'cpu',session_options:{intraOpNumThreads:threads,interOpNumThreads:1}};
let vision,processor,lastNetworkEvent=0;
const progress=info=>{if(!['progress','download','done'].includes(info.status)||!info.total||info.total<1048576||Date.now()-lastNetworkEvent<300&&info.status!=='done')return;lastNetworkEvent=Date.now();process.send?.({code:'modelDownloading',network:{loaded:info.loaded||0,total:info.total,file:'CLIP'}});};
const cached=path.join(env.cacheDir,modelId,'onnx/vision_model_quantized.onnx');try{if((await fs.stat(cached)).size===0)await fs.unlink(cached);}catch{}
async function analyze(item){
 let embedding=item.embedding;
 if(!validEmbedding(embedding)){
  if(!vision){process.send?.({code:'modelLoading'});processor=await AutoProcessor.from_pretrained(modelId,{...offline,progress_callback:progress});vision=await CLIPVisionModelWithProjection.from_pretrained(modelId,{...options,progress_callback:progress});process.send?.({code:'modelReady'});}
  const sharp=await sharpModule();sharp.concurrency(1);
  const source=item.bytes?Buffer.from(item.bytes,'base64'):path.join(dir,'thumbnails',item.id+'.jpg');
  const {data,info}=await sharp(source,{limitInputPixels:64000000,animated:false}).rotate().resize(512,512,{fit:'inside',withoutEnlargement:true}).removeAlpha().toColourspace('srgb').raw().toBuffer({resolveWithObject:true});
  const output=await vision(await processor(new RawImage(new Uint8Array(data),info.width,info.height,info.channels)));
  embedding=Array.from(output.image_embeds.data);
 }
 return {id:item.id,embedding,embeddingVersion};
}
if(process.argv.includes('--service')){
 let chain=Promise.resolve();process.on('message',m=>{chain=chain.then(async()=>{try{process.send?.({...await analyze(m),request:m.request});}catch(e){process.send?.({request:m.request,error:true,detail:String(e.message).slice(0,1500)});}});});
 process.on('disconnect',()=>process.exit(0));process.send?.({ready:true});
}else{
 try{for(const item of JSON.parse(await fs.readFile(path.join(dir,'ai-input.json'),'utf8')))process.send?.(await analyze(item));}finally{await vision?.dispose();}
}
