const fs = require('fs');
const path = 'apps/backend/src/modules/leetcode/leetcode.service.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'const TWO_HOURS_MS = 2 * 60 * 60 * 1000;',
  'const TWO_HOURS_MS = 2 * 1000; // REDUCED TO 2 SECONDS FOR TESTING!'
);

fs.writeFileSync(path, content);
console.log("Successfully reduced cache time to 2 seconds!");
