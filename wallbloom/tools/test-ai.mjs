export class AISession{
 async request({id}){return {id,embeddingVersion:2,embedding:[id.includes('bad')?0:1,id.includes('bad')?1:0,...Array(510).fill(0)],aiTitle:{version:1,ru:'Изображение',en:'Image'}};}
 close(){}
}
