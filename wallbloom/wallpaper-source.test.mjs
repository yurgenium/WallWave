import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperSource} from './public/wallpaper-source.js';
test('only source is displayed even if tags and old captions are misleading',()=>{
 const item={provider:'wallhaven',title:'Wrong name',tags:['forest'],aiTitle:{ru:'Уютный интерьер',en:'Cozy interior'}};
 for(const lang of ['ru','en'])assert.equal(wallpaperSource(item,[],lang),'Wallhaven');
});
test('custom provider names and local folders retain their provenance',()=>{
 assert.equal(wallpaperSource({provider:'mine'},[{id:'mine',type:'feed',name:'My collection'}]),'My collection');
 const providers=[{id:'local',type:'local',name:'Local folder'}];
 assert.equal(wallpaperSource({provider:'local'},providers),'Локальная папка');
 assert.equal(wallpaperSource({provider:'local'},providers,'en'),'Local folder');
});
test('removed providers fall back to source hostname without inventing content',()=>{
 assert.equal(wallpaperSource({provider:'removed',source:'https://www.example.org/photo/1'}),'example.org');
 assert.equal(wallpaperSource({title:'Forest',tags:['forest']}),'Источник неизвестен');
 assert.equal(wallpaperSource({source:'javascript:alert(1)'},[],'en'),'Unknown source');
});
