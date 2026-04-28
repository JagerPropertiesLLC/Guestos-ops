const fs = require('fs');
const p = 'app/api/swppp/inspections/[id]/route.js';
let c = fs.readFileSync(p, 'utf8');
if (c.includes("start_time === ''")) {
  console.log('already patched');
  process.exit(0);
}
c = c.replace(
  /(const body = await request\.json\(\);)/,
  "$1\n    if (body.start_time === '') body.start_time = null;\n    if (body.end_time === '') body.end_time = null;"
);
fs.writeFileSync(p, c);
console.log('patched');
