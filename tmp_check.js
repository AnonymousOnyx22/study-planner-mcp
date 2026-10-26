const fs=require('fs');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const readme=fs.readFileSync('README.md','utf8');
const idx=readme.indexOf('## Keywords');
const sub=readme.slice(idx, idx+500);
console.log(sub);
