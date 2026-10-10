import test from 'node:test';
import assert from 'node:assert/strict';
import {wallpaperTitle,technicalTitle} from './public/wallpaper-titles.js';
test('source IDs become descriptive titles in both languages',()=>{
 const item={id:'wallhaven-d8v5jm',title:'Wallhaven d8v5jm',tags:['mountains','sunset']};
 assert.equal(wallpaperTitle(item),'Горы на закате');assert.equal(wallpaperTitle(item,'en'),'Mountains at sunset');
 assert.equal(wallpaperTitle({...item,tags:['fog','forest']}),'Лес в тумане');
 assert.equal(wallpaperTitle({...item,tags:['anime girls','anime']}),'Аниме-портрет');
 assert.equal(wallpaperTitle({...item,tags:['black hole','space']}),'Чёрная дыра');
 assert.equal(item.title,'Wallhaven d8v5jm');
});
test('genuine names survive, including numbered names and local filenames',()=>{
 for(const name of ['Горное отражение','Blade Runner 2049','Summer_2026','Mountain sunset.jpg'])assert.equal(wallpaperTitle({id:'local-123',title:name,tags:['space']}),name.replace(/\.jpg$/,''));
 assert.equal(technicalTitle({id:'wallhaven-d8v5jm',title:'d8v5jm.jpg'}),true);
 assert.equal(technicalTitle({title:'abcdef0123456789.jpg'}),true);
});
test('unknown subjects use available metadata without fabricating a scene',()=>{
 const item={id:'wallhaven-d8v5jm',title:'Wallhaven d8v5jm'};
 assert.equal(wallpaperTitle(item),'Изображение без описания');
 assert.equal(wallpaperTitle({...item,tags:['8k','Reze','Chainsaw Man']}),'Reze · Chainsaw Man');
 assert.equal(wallpaperTitle({...item,tags:'forest'}),'Изображение без описания');
});
