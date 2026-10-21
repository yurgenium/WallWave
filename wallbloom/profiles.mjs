import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {persist,readPersistent} from './persistence.mjs';
import {AppError,defaults,validate} from './core.mjs';

export class Profiles{
 constructor(root){this.root=path.resolve(root);this.home=this.root+'.profiles';this.file=path.join(this.home,'catalog.json');}
 async open(){
  await fs.mkdir(this.home,{recursive:true});
  this.catalog=await readPersistent(this.file,{active:'main',entries:[{id:'main',name:null,primary:true,created:Date.now()}]});
  if(!Array.isArray(this.catalog.entries)||!this.catalog.entries.some(p=>p.id==='main'&&p.primary)||!this.list().some(p=>p.id===this.catalog.active))throw new AppError('invalidProfiles');
  for(const p of this.catalog.entries)this.directory(p.id);
  await this.save();return this;
 }
 list(){return this.catalog.entries.filter(p=>!p.deleted).map(({deleted,...p})=>({...p}));}
 get active(){return this.catalog.active;}
 directory(id=this.active){if(id==='main')return this.root;if(!/^[a-f0-9-]{36}$/.test(id))throw new AppError('invalidProfiles');return path.join(this.home,id);}
 find(id){const p=this.list().find(p=>p.id===id);if(!p)throw new AppError('profileNotFound');return p;}
 name(value,id){if(typeof value!=='string'||!value.trim()||value.trim().length>80||/[\x00-\x1f]/.test(value))throw new AppError('invalidProfileName');const name=value.trim();if(this.list().some(p=>p.id!==id&&(p.name?[p.name]:p.primary?['Основной профиль','Main profile']:[]).some(value=>value.toLocaleLowerCase()===name.toLocaleLowerCase())))throw new AppError('profileNameExists');return name;}
 async save(){await persist(this.file,this.catalog);}
 async create(name,{copySettings=false,primarySettings,providers=[]}={}){
  name=this.name(name);if(this.list().length>=50)throw new AppError('profileLimit');
  const p={id:randomUUID(),name,created:Date.now()},dir=this.directory(p.id);
  await fs.mkdir(dir,{recursive:false});
  const settings=validate(structuredClone(copySettings?primarySettings:defaults));
  await persist(path.join(dir,'state.json'),{settings,sourceCatalogVersion:1,providers:structuredClone(providers),items:[],pages:{},current:null,lastRefresh:0,lastRotation:0,paused:false});
  await persist(path.join(dir,'credentials.json'),{});this.catalog.entries.push(p);await this.save();return p;
 }
 async rename(id,name){this.find(id);const p=this.catalog.entries.find(p=>p.id===id);p.name=this.name(name,id);await this.save();return {...p};}
 async activate(id){this.find(id);this.catalog.active=id;await this.save();}
 async remove(id){const p=this.find(id);if(p.primary||id===this.active)throw new AppError('profileProtected');this.catalog.entries.find(p=>p.id===id).deleted=Date.now();await this.save();}
}
