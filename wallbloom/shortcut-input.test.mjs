import test from 'node:test';
import assert from 'node:assert/strict';
import {acceleratorFromEvent} from './public/shortcut-input.js';
test('shortcut recording supports Alt+1 and physical keys in both keyboard layouts',()=>{
 assert.equal(acceleratorFromEvent({key:'1',code:'Digit1',altKey:true}),'Alt+1');
 for(const key of ['n','т'])assert.equal(acceleratorFromEvent({key,code:'KeyN',ctrlKey:true,altKey:true}),'Ctrl+Alt+N');
 assert.equal(acceleratorFromEvent({key:'!',code:'Digit1',altKey:true,shiftKey:true}),'Alt+Shift+1');
 assert.equal(acceleratorFromEvent({key:'F10',code:'F10',ctrlKey:true,altKey:true,shiftKey:true}),'Ctrl+Alt+Shift+F10');
});
test('shortcut recording distinguishes numpad and navigation keys and ignores modifiers and repeats',()=>{
 assert.equal(acceleratorFromEvent({key:'1',code:'Numpad1',altKey:true}),'Alt+num1');
 assert.equal(acceleratorFromEvent({key:'ArrowUp',code:'ArrowUp',ctrlKey:true}),'Ctrl+Up');
 assert.equal(acceleratorFromEvent({key:' ',code:'Space',metaKey:true}),'Super+Space');
 for(const event of [{key:'Alt',code:'AltLeft',altKey:true},{key:'1',code:'Digit1',altKey:true,repeat:true},{key:'Process',code:'KeyA',isComposing:true},{key:'Unidentified',code:'Unknown'}])assert.equal(acceleratorFromEvent(event),null);
});
