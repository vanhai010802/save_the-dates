import test from 'node:test';
import assert from 'node:assert/strict';
import upload from '../api/blob-upload.js';
import media from '../api/media.js';
import { isR2MediaURL, MAX_MEDIA_BYTES } from '../api/_r2.js';

async function request(handler, overrides) {
  const result = { headers: {} };
  await handler({ method: 'POST', headers: { 'x-admin-password': 'test-password' }, ...overrides }, {
    status(code) { result.status = code; return this; },
    setHeader(name, value) { result.headers[name] = value; return this; },
    end(body) { result.body = body ? JSON.parse(body) : undefined; },
  });
  return result;
}

test('R2 upload requires admin and signs the exact type, size, and a unique key', async t => {
  const env = {
    ADMIN_PASSWORD: 'test-password',
    R2_ACCOUNT_ID: 'a'.repeat(32),
    R2_BUCKET: 'test-bucket',
    R2_ACCESS_KEY_ID: 'test-id',
    R2_SECRET_ACCESS_KEY: 'test-secret',
  };
  const original = Object.fromEntries(Object.keys(env).map(name => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const body = { action: 'prepare', pathname: 'milestones/123/photo.jpg', contentType: 'image/jpeg', size: 1000 };
  for (const name of Object.keys(env)) delete process.env[name];
  process.env.ADMIN_PASSWORD = env.ADMIN_PASSWORD;
  assert.deepEqual((await request(upload, { body })).body, { provider: 'vercel' });
  Object.assign(process.env, env);
  assert.equal((await request(upload, { body, headers: {} })).status, 401);
  assert.equal((await request(upload, { body: { ...body, size: MAX_MEDIA_BYTES + 1 } })).status, 413);
  assert.equal((await request(upload, { body: { ...body, pathname: 'avatars/../../photo.jpg' } })).status, 400);
  assert.equal((await request(upload, { body: { ...body, contentType: 'text/html' } })).status, 400);

  const first = await request(upload, { body });
  assert.equal(first.status, 200);
  assert.equal(first.body.provider, 'r2');
  assert.ok(isR2MediaURL(first.body.url));
  const signed = new URL(first.body.uploadUrl);
  assert.match(signed.hostname, /\.r2\.cloudflarestorage\.com$/);
  assert.equal(signed.searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host');
  assert.equal(signed.searchParams.get('X-Amz-Expires'), '900');
  assert.notEqual((await request(upload, { body })).body.url, first.body.url);

  const get = await request(media, { method: 'GET', url: first.body.url });
  const head = await request(media, { method: 'HEAD', url: first.body.url });
  assert.equal(get.status, 307);
  assert.equal(head.status, 307);
  assert.equal(new URL(get.headers.Location).pathname, signed.pathname);
  assert.notEqual(get.headers.Location, head.headers.Location);
  assert.equal((await request(media, { method: 'GET', url: '/api/media?key=private.json' })).status, 400);
});
