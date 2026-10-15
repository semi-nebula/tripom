// Copies the PWA sources (repo root) into www/ for Capacitor.
// The website stays the single source of truth: index.html, todo.html,
// styles, manifest, service worker and icons are shared verbatim so the
// Android app behaves - and syncs - exactly like pomoharbor.vercel.app.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const FILES = ['index.html', 'todo.html', 'manifest.json', 'sw.js', 'tailwind.5d20233c.css'];
const DIRS = ['icons'];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const f of FILES) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(www, f));
  else console.warn('[copy-web] missing:', f);
}
for (const d of DIRS) {
  const src = path.join(root, d);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(www, d), { recursive: true });
  else console.warn('[copy-web] missing dir:', d);
}
console.log('[copy-web] www/ ready');
