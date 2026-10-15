import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate} from './core.mjs';
import {tasteProfile,assessTaste,tasteSignature} from './visual-ai.mjs';
const vector=(a,b=0)=>[a,b,...Array(510).fill(0)];
const samples=()=>Array.from({length:5},(_,i)=>[{id:'p'+i,vote:'like',embeddingVersion:2,embedding:vector(1)},{id:'n'+i,vote:'dislike',embeddingVersion:2,embedding:vector(0,1)}]).flat();
test('cautious is default; filtering settings reject unknown values',()=>{
 assert.equal(validate({}).aiFilter,'cautious');assert.equal(validate({...defaults,aiFilter:'strict'}).aiFilter,'strict');assert.throws(()=>validate({...defaults,aiFilter:'delete'}));
});
test('taste screening needs both classes and never treats an exclusion as a dislike',()=>{
 const items=samples().filter(x=>x.vote==='like');for(let i=0;i<30;i++)items.push({id:'ban'+i,vote:'ban',embeddingVersion:2,embedding:vector(0,1)});
 assert.deepEqual(assessTaste(vector(0,1),tasteProfile(items)),{rejected:false,reason:'learning'});
 const p=tasteProfile(samples());assert.equal(assessTaste(vector(0,1),p).rejected,true);assert.equal(assessTaste(vector(1),p).rejected,false);
 assert.equal(assessTaste(Array(512).fill(NaN),p).rejected,false);
});
test('balanced neighbors ignore duplicated negative votes; profile changes invalidate screening',()=>{
 const items=samples(),p=tasteProfile(items),extra=items.concat(Array.from({length:100},(_,i)=>({id:'extra'+i,vote:'dislike',embeddingVersion:2,embedding:vector(0,1)})));
 assert.equal(assessTaste(vector(.8,.2),p).margin,assessTaste(vector(.8,.2),tasteProfile(extra)).margin);
 const sig=tasteSignature(items);items[0].vote='dislike';assert.notEqual(tasteSignature(items),sig);
});
test('strict mode rejects borderline dislikes which cautious mode preserves',()=>{
 const p=tasteProfile(samples()),e=vector(.69,.72);
 assert.equal(assessTaste(e,p,'cautious').rejected,false);assert.equal(assessTaste(e,p,'strict').rejected,true);
});
