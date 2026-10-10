// Descriptive labels from source metadata; these are not author-supplied titles.
const subjects=[
 ['black hole|black holes|чёрная дыра|черная дыра','Чёрная дыра','Black hole'],
 ['planets|planet|планета|планеты','Планеты','Planets'],
 ['galaxy|galaxies|milky way|nebula|space|stars|космос|звёзды','Космос','Space'],
 ['mountain|mountains|alps|горы','Горы','Mountains'],
 ['forest|woods|trees|лес','Лес','Forest'],
 ['ocean|sea|beach|coast|waves|море|океан','Морской пейзаж','Seascape'],
 ['lake|lakes|озеро','Озеро','Lake'],
 ['waterfall|waterfalls|водопад','Водопад','Waterfall'],
 ['river|rivers|река','Река','River'],
 ['city|cityscape|skyline|skyscraper|skyscrapers|город','Город','City'],
 ['architecture|building|buildings|house|interior|архитектура','Архитектура','Architecture'],
 ['flower|flowers|spider lilies|cherry blossom|цветы','Цветы','Flowers'],
 ['cat|cats|kitten|kittens|кошки|кот','Кошки','Cats'],
 ['dog|dogs|puppy|puppies|собаки','Собаки','Dogs'],
 ['bird|birds|птицы','Птицы','Birds'],
 ['wildlife|animals|animal|животные','Животные','Animals'],
 ['car|cars|vehicle|vehicles|supercar|машины|автомобиль','Автомобиль','Car'],
 ['motorcycle|motorcycles|мотоцикл','Мотоцикл','Motorcycle'],
 ['anime girls|anime girl|anime boys|anime boy','Аниме-портрет','Anime portrait'],
 ['anime|аниме','Аниме-иллюстрация','Anime illustration'],
 ['portrait|portraits|woman|women|man|men|girl|girls|people|портрет','Портрет','Portrait'],
 ['gradient|gradients|градиент','Цветовой градиент','Color gradient'],
 ['abstract|abstraction|абстракция','Абстракция','Abstract art'],
 ['landscape|landscapes|scenery|nature|природа|пейзаж','Природный пейзаж','Nature landscape'],
 ['digital art|artwork|illustration|painting|art|иллюстрация','Иллюстрация','Illustration'],
].map(([aliases,ru,en])=>({aliases:aliases.split('|'),ru,en}));
const clean=value=>String(value??'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160);
export function technicalTitle(item){
 const raw=clean(item.title),stem=raw.replace(/\.(?:jpe?g|png|webp|avif)$/i,'');
 const id=String(item.id??''),sourceId=id.replace(/^.*?-/, '');
 return !stem||stem===id||stem===sourceId||/^wallhaven[\s_-]+[a-z\d]{6}$/i.test(stem)||/^\d+$/.test(stem)||/^[a-f\d]{8,}$/i.test(stem)||/^[a-z\d]{6}$/i.test(stem)&&/[a-z]/i.test(stem)&&/\d/.test(stem);
}
export function wallpaperTitle(item,language='ru'){
 if(!technicalTitle(item))return clean(item.title).replace(/\.(?:jpe?g|png|webp|avif)$/i,'');
 const lang=language==='en'?'en':'ru',tags=(Array.isArray(item.tags)?item.tags:[]).filter(t=>typeof t==='string').map(clean),known=new Set(tags.map(t=>t.toLowerCase()));
 const has=aliases=>aliases.split('|').some(t=>known.has(t));
 const subject=subjects.find(s=>s.aliases.some(t=>known.has(t)));
 if(subject){
  if(subject.ru==='Горы'&&has('lake|lakes|озеро'))return lang==='ru'?'Горы у озера':'Mountains by a lake';
  let title=subject[lang];
  const conditions=[['fog|mist|misty|туман','в тумане','in the mist'],['sunset|закат','на закате','at sunset'],['sunrise|dawn|рассвет','на рассвете','at dawn'],['night|nighttime|ночь','ночью','at night'],['snow|winter|снег|зима','в снегу','in the snow']];
  // Weather and time are useful for scenes, but do not describe abstract art.
  if(!['Цветовой градиент','Абстракция','Чёрная дыра','Планеты','Космос'].includes(subject.ru)){const condition=conditions.find(c=>has(c[0]));if(condition)title+=' '+condition[lang==='ru'?1:2];}
  return title;
 }
 const descriptive=tags.filter(t=>!/^\d+$/.test(t)&&!/^\d+[x×]\d+$/i.test(t)&&!/^wallhaven[\s_-]/i.test(t)&&!['sfw','nsfw','4k','8k','hd','wallpaper','wallpapers','high resolution'].includes(t.toLowerCase())).slice(0,2);
 if(descriptive.length)return descriptive.map(t=>t.charAt(0).toUpperCase()+t.slice(1)).join(' · ');
 return lang==='ru'?'Изображение без описания':'Image without a description';
}
