import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,validate} from './core.mjs';
import {effectiveMonitorPurity,contentConflicts,inheritConflictingMonitorFilters} from './public/monitor-content.js';

test('legacy monitor restrictions are preserved; explicit inheritance tracks the global filter',()=>{
 const monitor={rotation:false,rotationMinutes:60,purity:'100',tags:['nature']};
 assert.equal(effectiveMonitorPurity('011',monitor),'000');
 assert.equal(effectiveMonitorPurity('011',{...monitor,inheritPurity:true}),'011');
 assert.equal(effectiveMonitorPurity('010',{...monitor,inheritPurity:true}),'010');
 assert.equal(effectiveMonitorPurity('011',undefined),'011');
 assert.equal(effectiveMonitorPurity('011',{...monitor,inheritPurity:true},true),'100');
 assert.equal(effectiveMonitorPurity('111',monitor),'100');
 assert.equal(validate({...defaults,monitors:{screen:{...monitor,inheritPurity:true}}}).monitors.screen.inheritPurity,true);
 assert.throws(()=>validate({...defaults,monitors:{screen:{...monitor,inheritPurity:'true'}}}),{code:'invalidSettings'});
});

test('repair only changes conflicting monitors after an explicit choice and preserves other settings',()=>{
 const state={settings:{...defaults,purity:'011',monitors:{a:{rotation:true,rotationMinutes:60,purity:'100',tags:['nature'],frame:{fit:'cover',x:0,y:0,flip:true}},b:{rotation:false,rotationMinutes:30,purity:'111',tags:[]}}},monitors:[{id:'a'},{id:'b'}]};
 assert.deepEqual(contentConflicts(state),[{id:'a',index:1}]);
 const fixed=inheritConflictingMonitorFilters(state);
 assert.equal(fixed.monitors.a.inheritPurity,true);assert.equal(state.settings.monitors.a.inheritPurity,undefined);
 assert.equal(fixed.monitors.a.rotation,true);assert.deepEqual(fixed.monitors.a.tags,['nature']);assert.deepEqual(fixed.monitors.a.frame,state.settings.monitors.a.frame);
 assert.deepEqual(fixed.monitors.b,state.settings.monitors.b);assert.deepEqual(contentConflicts({...state,settings:fixed}),[]);
 assert.deepEqual(contentConflicts({...state,workMode:true}),[]);
});
