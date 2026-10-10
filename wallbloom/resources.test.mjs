import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceAvailability} from './resources.mjs';
test('resource guard uses CPU/GPU pressure and available memory rather than input activity',()=>{const GiB=1024**3;assert.equal(resourceAvailability({cpuLoad:20,gpuLoad:15},8*GiB,16*GiB).ready,true);for(const m of [{cpuLoad:41,gpuLoad:0},{cpuLoad:10,gpuLoad:51}])assert.equal(resourceAvailability(m,8*GiB,16*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:0},1.9*GiB,8*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:0},8*GiB,64*GiB).ready,false);assert.equal(resourceAvailability({cpuLoad:10,gpuLoad:null},8*GiB,16*GiB).ready,true);});
