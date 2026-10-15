const clean=value=>typeof value==='string'?value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160):'';
// Only provenance is displayed. Tags, filenames and old AI captions are not titles.
export function wallpaperSource(item,providers=[],language='ru'){
 const local=language==='en'?'Local folder':'Локальная папка',unknown=language==='en'?'Unknown source':'Источник неизвестен';
 const provider=providers.find(p=>p.id===item.provider),name=clean(provider?.name);
 if(provider?.type==='local'&&['Local','Local folder','Локальная папка',''].includes(name))return local;
 if(name)return name;
 const known={wallhaven:'Wallhaven',bing:'Bing',nasa:'NASA Images',commons:'Wikimedia Commons',local};
 if(Object.hasOwn(known,item.provider))return known[item.provider];
 for(const value of [item.source,item.url])try{const url=new URL(value);if(['https:','http:'].includes(url.protocol)&&url.hostname)return url.hostname.replace(/^www\./i,'');}catch{}
 return unknown;
}
