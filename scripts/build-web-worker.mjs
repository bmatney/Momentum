import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const root = 'work/web-dist';
async function list(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await list(join(dir, entry.name), `${name}/`));
    else if (name !== 'sw.js') files.push(name);
  }
  return files.sort();
}
const files = await list(root);
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(root, file)));
const version = hash.digest('hex').slice(0, 16);
const worker = `// Generated from the complete web build. Updates activate only after existing clients close.
const CACHE = 'momentum-play-${version}';
const PREFIX = 'momentum-play-';
const ASSETS = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.href.startsWith(self.registration.scope)) return;
  const key = event.request.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : event.request;
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(key)) || fetch(event.request)));
});
`;
await writeFile(join(root, 'sw.js'), worker);
console.log(`Offline build ${version}: ${files.length} cached files`);
