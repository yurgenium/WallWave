export function hasPortraitScreen(monitors,desktop){
 const screens=monitors.length?monitors:desktop?[desktop]:[];
 return screens.some(x=>Number(x.height)>Number(x.width)&&Number(x.width)>0);
}
export function portraitImage(item){
 const width=Number(item.sourceWidth||item.originalWidth||item.width),height=Number(item.sourceHeight||item.originalHeight||item.height);
 return width>0&&height>0?height>width:null;
}
export function sourceDimensions(meta){
 const swapped=meta.orientation>=5&&meta.orientation<=8;
 return {sourceWidth:swapped?meta.height:meta.width,sourceHeight:swapped?meta.width:meta.height};
}
