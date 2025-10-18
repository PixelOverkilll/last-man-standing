const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '..');
const jsPath = path.join(base, 'js', 'app.js');
const htmlPath = path.join(base, 'index.html');

function replaceInFile(p, re, repl) {
  if (!fs.existsSync(p)) return { changed: false, before: 0, after: 0 };
  let s = fs.readFileSync(p, 'utf8');
  const before = (s.match(re) || []).length;
  s = s.replace(re, repl);
  const after = (s.match(re) || []).length;
  if (before !== after) fs.writeFileSync(p, s, 'utf8');
  return { changed: before !== after, before, after };
}

console.log('Patching files to remove forced show-fallback...');

const resJs = replaceInFile(jsPath, /btnToggle\.classList\.add\('show-fallback'\);/g, '');
console.log('js/app.js: removed occurrences -> before=', resJs.before, 'after=', resJs.after);

// Remove initial class attribute in index.html if present
const resHtml = replaceInFile(htmlPath, /class=("|')([^"']*?)\bshow-fallback\b([^"']*?)("|')/g, (m, q1, p2, p3, q4) => {
  // Rebuild class attribute without show-fallback
  const classes = (p2 + ' ' + p3).trim().split(/\s+/).filter(c => c && c !== 'show-fallback');
  return `class=${q1}${classes.join(' ')}${q4}`;
});
console.log('index.html: removed initial show-fallback in class attribute if present -> before/after count not tracked for HTML replacement');

console.log('Done.');

