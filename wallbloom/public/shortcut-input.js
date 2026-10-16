const keys={Space:'Space',Enter:'Enter',NumpadEnter:'Enter',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Backspace:'Backspace',Delete:'Delete',Insert:'Insert',Home:'Home',End:'End',PageUp:'PageUp',PageDown:'PageDown',Tab:'Tab',Escape:'Escape',CapsLock:'Capslock',NumLock:'Numlock',ScrollLock:'Scrolllock',PrintScreen:'PrintScreen',NumpadDecimal:'numdec',NumpadAdd:'numadd',NumpadSubtract:'numsub',NumpadMultiply:'nummult',NumpadDivide:'numdiv',Minus:'-',Equal:'=',BracketLeft:'[',BracketRight:']',Backslash:'\\',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backquote:'`'};
export function acceleratorFromEvent(event){
 if(event.isComposing||event.repeat||/^(Control|Alt|Shift|Meta|OS|AltGraph)$/.test(event.key))return null;
 let key=/^Key[A-Z]$/.test(event.code)?event.code.slice(3):/^Digit[0-9]$/.test(event.code)?event.code.slice(5):/^Numpad[0-9]$/.test(event.code)?'num'+event.code.slice(6):/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)?event.code:keys[event.code];
 if(!key)return null;
 const modifiers=[];if(event.ctrlKey)modifiers.push('Ctrl');if(event.altKey)modifiers.push('Alt');if(event.shiftKey)modifiers.push('Shift');if(event.metaKey)modifiers.push('Super');
 return [...modifiers,key].join('+');
}
export function setupShortcutInputs(form,{setCapture=()=>{}}={}){
 window.addEventListener('focus',()=>{if(form.querySelector('input[name^="shortcut_"]:focus'))setCapture(true);});
 for(const input of form.querySelectorAll('input[name^="shortcut_"]')){
  input.autocomplete='off';input.spellcheck=false;let previous='';
  input.addEventListener('focus',()=>{previous=input.value;input.classList.add('shortcut-recording');setCapture(true);});
  input.addEventListener('blur',()=>{input.classList.remove('shortcut-recording');setCapture(false);});
  input.addEventListener('keydown',event=>{
   if(event.key==='Tab'&&!event.ctrlKey&&!event.altKey&&!event.metaKey)return;
   event.preventDefault();event.stopPropagation();
   const modified=event.ctrlKey||event.altKey||event.shiftKey||event.metaKey;
   if(!modified&&event.key==='Escape'){input.value=previous;input.blur();return;}
   if(!modified&&event.key==='Enter'){input.blur();return;}
   if(!modified&&['Backspace','Delete'].includes(event.key))input.value='';
   else{const value=acceleratorFromEvent(event);if(value===null)return;input.value=value;}
   input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  input.addEventListener('keyup',event=>{if(event.key!=='Tab'){event.preventDefault();event.stopPropagation();}});
 }
}
