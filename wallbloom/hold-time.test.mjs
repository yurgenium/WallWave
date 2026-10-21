import test from 'node:test';
import assert from 'node:assert/strict';
import {parseClock,clockText,durationText} from './public/hold-time.js';
test('custom hold time accepts 24-hour digits, rolls to the next day and rejects invalid input',()=>{
 const now=new Date(2026,9,20,15,20,0);assert.equal(clockText(new Date(parseClock('2345',now))),'23:45');assert.equal(clockText(new Date(parseClock('0930',now))),'09:30');assert.equal(new Date(parseClock('0930',now)).getDate(),21);assert.equal(clockText(new Date(parseClock('0000',now))),'00:00');
 for(const input of ['2400','2360','9999','930','1','-130','12x0'])assert.equal(parseClock(input,now),null,input);
 assert.equal(durationText(3600000,'ru'),'1 ч');assert.equal(durationText(90000000,'en'),'1 d 1 h');
});
