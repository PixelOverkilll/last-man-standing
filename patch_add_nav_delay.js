const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, 'js', 'app.js');
const bak = filePath + '.navdelay.bak';
let s = fs.readFileSync(filePath, 'utf8');
fs.writeFileSync(bak, s, 'utf8');
console.log('Backup saved to', bak);

// Replace direct "window.location.href = 'lobby.html?code=' + encodeURIComponent(...)" with delayed setTimeout
let replaced = 0;
let out = s.replace(/window.location.href\s*=\s*'lobby.html\?code='\s*\+\s*encodeURIComponent\(([^)]+)\);/g, (m, p1) => {
  replaced++;
  return `setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(${p1}); }, 150);`;
});

out = out.replace(/window.location.href\s*=\s*`lobby.html\?code=\$\{([^}]+)\}`;/g, (m, p1) => {
  replaced++;
  return `setTimeout(function(){ window.location.href = 'lobby.html?code=' + encodeURIComponent(${p1}); }, 150);`;
});

fs.writeFileSync(filePath, out, 'utf8');
console.log('Replacements done:', replaced);

