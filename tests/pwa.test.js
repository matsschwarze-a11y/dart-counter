import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('Service Worker cached alle App-Dateien (Offline-Fähigkeit)', () => {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]));
  const needed = ['js', 'css', 'icons'].flatMap((d) => walk(join(ROOT, d))).map((p) => relative(ROOT, p).split('\\').join('/'));
  for (const f of [...needed, 'index.html', 'manifest.webmanifest']) assert.ok(listed.has(f), `fehlt im Service Worker: ${f}`);
  for (const f of listed) if (f) assert.doesNotThrow(() => statSync(join(ROOT, f)), `existiert nicht: ${f}`);
});

test('Nur relative Pfade (GitHub Pages unter /<repo>/)', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.ok(!/(src|href)="\//.test(html), 'absoluter Pfad in index.html');
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  for (const i of manifest.icons) assert.ok(!i.src.startsWith('/'));
  for (const f of walk(join(ROOT, 'js'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/from '([^']+)'/g)) assert.ok(m[1].startsWith('.'), `${f}: ${m[1]}`);
  }
});
