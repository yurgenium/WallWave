import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceAvailability,ResourcePressureGuard} from './resources.mjs';
test('resource guard uses CPU/GPU pressure and available memory rather than input activity',()=>{const GiB=1024**3;assert.equal(resourceAvailability({cpuLoad:20,gpuLoad:15},8*GiB,16*GiB).ready,true);for(const m of [{cpuLoad:41,gpuLoad:0},{cpuLoad:10,gpuLoad:51}])assert.equal(resourceAvailability(m,8*GiB,16*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:0},1.9*GiB,8*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:0},8*GiB,64*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:null},8*GiB,16*GiB).ready,true);});

const GiB=1024**3,normal={cpuLoad:20,gpuLoad:10};
test('isolated and repeated short CPU/GPU spikes do not interrupt a batch',()=>{
 const guard=new ResourcePressureGuard(),sample=(metrics,time)=>guard.update(metrics,8*GiB,16*GiB,time).ready;
 assert(sample(normal,0));assert(sample({cpuLoad:85,gpuLoad:10},2500));assert(sample(normal,5000));
 assert(sample({cpuLoad:20,gpuLoad:90},7500));assert(sample(normal,10000));assert(sample({cpuLoad:75,gpuLoad:70},12500));assert(sample(normal,15000));
});
test('sustained pressure pauses after ten seconds, and recovery must remain stable',()=>{
 const guard=new ResourcePressureGuard(),heavy={cpuLoad:70,gpuLoad:20},sample=(metrics,time)=>guard.update(metrics,8*GiB,16*GiB,time).ready;
 for(const time of [0,2500,5000,7500])assert(sample(heavy,time));assert.equal(sample(heavy,10000),false);
 assert.equal(sample(normal,12500),false);assert.equal(sample(heavy,15000),false);assert.equal(sample(normal,17500),false);assert.equal(sample(normal,20000),false);assert(sample(normal,22500));
});
test('insufficient memory interrupts immediately and keeps protection during recovery',()=>{
 const guard=new ResourcePressureGuard();assert.equal(guard.update(normal,1.5*GiB,16*GiB,0).ready,false);assert.equal(guard.update(normal,8*GiB,16*GiB,2500).ready,false);assert(guard.update(normal,8*GiB,16*GiB,7500).ready);
});
