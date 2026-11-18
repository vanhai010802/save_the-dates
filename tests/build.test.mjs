import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

test('each build versions HTML, nested modules, dynamic styles and JSON without exposing server files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'save-dates-build-'));
  const write = async (file, content) => { await mkdir(dirname(join(root, file)), {recursive:true}); await writeFile(join(root, file), content); };
  try {
    const html = '<meta name="app-version" content="development"><script src="/assets/app.js"></script><link href="/assets/style.css">';
    await write('index.html', html); await write('anniversary.html', html);
    await write('assets/app.js', `import './child.js'; const style='/assets/style.css'; fetch('/assets/list.json'); import('/assets/upload.js'); const remote='https://example.test/remote.js';`);
    await write('assets/child.js', 'export const answer=1;');
    await write('assets/style.css', 'body{color:red}'); await write('assets/list.json', '[]');
    await write('assets/photo.jpg', Buffer.from([0,1,2,255]));
    await write('api/data.js', 'server-only'); await write('vercel.json', '{}'); await write('scripts/build.mjs', 'build-source');
    const first = await buildSite(root);
    const built = await readFile(join(first.output, 'assets/app.js'), 'utf8');
    assert.match(built, new RegExp(`'./child.js\\?v=${first.version}'`));
    assert.ok(built.includes(`/assets/style.css?v=${first.version}`));
    assert.ok(built.includes(`/assets/list.json?v=${first.version}`));
    assert.ok(built.includes(`/assets/upload.js?v=${first.version}`));
    assert.ok(built.includes('https://example.test/remote.js'));
    assert.ok((await readFile(join(first.output, 'index.html'), 'utf8')).includes(`content="${first.version}"`));
    assert.equal(JSON.parse(await readFile(join(first.output, 'version.json'), 'utf8')).version, first.version);
    assert.deepEqual(await readFile(join(first.output, 'assets/photo.jpg')), Buffer.from([0,1,2,255]));
    await assert.rejects(readFile(join(first.output, 'api/data.js')), {code:'ENOENT'});
    assert.equal((await buildSite(root)).version, first.version, 'unchanged sources keep the same version');
    await write('assets/child.js', 'export const answer=2;');
    assert.notEqual((await buildSite(root)).version, first.version, 'a nested module change invalidates all entry points');
    assert.equal(await readFile(join(root, 'index.html'), 'utf8'), html, 'build never modifies source HTML');
  } finally { await rm(root, {recursive:true, force:true}); }
});
