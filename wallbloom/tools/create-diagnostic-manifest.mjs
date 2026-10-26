// Only shipped application code can appear in exported stack coordinates.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const files=new Set(pkg.build.files.filter(file=>/^[^/]+\.mjs$/.test(file)));
for(const folder of ['desktop','public'])for(const file of await fs.readdir(path.join(root,folder)))if(/\.(?:cjs|js)$/.test(file)&&!file.includes('.test.'))files.add(file);
await fs.writeFile(path.join(root,'desktop','diagnostic-files.json'),JSON.stringify([...files].sort(),null,2)+'\n');
const {strings}=await import('../public/i18n.js');
await import('../public/feature-strings.js');await import('../public/panel-source-strings.js');await import('../public/monitor-content.js');
await fs.writeFile(path.join(root,'desktop','diagnostic-codes.json'),JSON.stringify(Object.keys(strings.en).sort(),null,2)+'\n');
