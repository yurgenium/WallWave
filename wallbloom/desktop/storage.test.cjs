const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {libraryDirectory}=require('./storage.cjs');
test('production library stays outside redirected AppData and does not depend on launcher',()=>{
 const home=path.resolve('test-user');
 const ordinary=libraryDirectory({home,appData:path.join(home,'AppData','Roaming')});
 const packaged=libraryDirectory({home,appData:path.join(home,'AppData','Local','Packages','Codex','LocalCache','Roaming')});
 assert.equal(ordinary,packaged);assert.equal(ordinary,path.join(home,'Wallbloom','library'));
 assert.equal(libraryDirectory({home,testHome:path.join(home,'test')}),path.join(home,'test','library'));
 assert.equal(libraryDirectory({home,dataDir:path.join(home,'custom')}),path.join(home,'custom'));
});
