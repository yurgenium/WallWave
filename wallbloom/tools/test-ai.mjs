import fs from 'node:fs/promises';
export class AISession{
 async request({id}){const config=process.env.WALLBLOOM_NATIVE_FIXTURE?JSON.parse(await fs.readFile(process.env.WALLBLOOM_NATIVE_FIXTURE,'utf8')):{};return {id,embeddingVersion:2,embedding:config.embeddings?.[id]||[id.includes('bad')?0:1,id.includes('bad')?1:0,...Array(510).fill(0)],aiTitle:{version:1,ru:'Изображение',en:'Image'}};}
 close(){}
}
