const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../src/main/game');
fs.writeFileSync(path.join(root,'game-controls.json'),JSON.stringify(fs.readFileSync(path.resolve(root,'../../renderer/theme/tokens.css'),'utf8')+fs.readFileSync(path.join(root,'controls.css'),'utf8'))+'\n');
const files=Object.fromEntries(['theme.json','theme.schema.json','engine.js','behavior.js','GUIDE.md','examples.json'].map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
fs.writeFileSync(path.resolve(__dirname,'../../src/shared/runner-template.json'),JSON.stringify(files,null,2)+'\n');
