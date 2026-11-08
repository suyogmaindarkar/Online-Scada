const fs = require('fs');
const c = fs.readFileSync('frontend/src/config/componentLibrary.js', 'utf8');
const paths = [];
const re = /\/symbols\/[^\s,'"\)]+/g;
let m;
while ((m = re.exec(c)) !== null) paths.push(m[0]);
const root = process.cwd() + '/frontend/public/symbols';
const disk = [];
(function walk(dir) {
  fs.readdirSync(dir).forEach((f) => {
    const p = dir + '/' + f;
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.svg')) disk.push('/symbols/' + p.replace(root + '/', ''));
  });
})(root);
console.log('Registered component paths: ' + paths.length);
const registeredNames = paths.map((p) => p.split('/').pop());
const missingOnDisk = paths.filter((p) => !disk.includes(p));
console.log('Registered but file missing on disk: ' + missingOnDisk.length);
missingOnDisk.forEach((p) => console.log('  MISSING: ' + p));
const onDiskNotRegistered = disk.filter((p) => !registeredNames.includes(p.split('/').pop()));
console.log('On disk but not registered: ' + onDiskNotRegistered.length);
onDiskNotRegistered.forEach((p) => console.log('  UNREG: ' + p));
