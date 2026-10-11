const path=require('node:path');
// AppData can be redirected by the MSIX identity of the process that launches us.
// Keep the actual wallpaper library in the user's home, shared by both launch paths.
function libraryDirectory({home,dataDir,testHome}){
 if(dataDir)return path.resolve(dataDir);
 return path.join(testHome||path.join(home,'WallWave'),'library');
}
module.exports={libraryDirectory};
