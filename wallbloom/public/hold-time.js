export const clockText=date=>String(date.getHours()).padStart(2,'0')+':'+String(date.getMinutes()).padStart(2,'0');
export function parseClock(value,now=new Date()){
 const digits=String(value).replace(':','');if(!/^\d{4}$/.test(digits))return null;
 const hours=Number(digits.slice(0,2)),minutes=Number(digits.slice(2));if(hours>23||minutes>59)return null;
 const until=new Date(now);until.setHours(hours,minutes,0,0);if(until<=now)until.setDate(until.getDate()+1);return until.getTime();
}
export function durationText(ms,language='ru'){
 const total=Math.max(0,Math.ceil(ms/60000)),days=Math.floor(total/1440),hours=Math.floor(total%1440/60),minutes=total%60;
 return [[days,language==='ru'?'дн':'d'],[hours,language==='ru'?'ч':'h'],[minutes,language==='ru'?'мин':'min']].filter(([n],i)=>n||i===2&&!days&&!hours).map(([n,u])=>n+' '+u).join(' ');
}
