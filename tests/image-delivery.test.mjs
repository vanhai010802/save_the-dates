import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { optimizedImageURL, setOptimizedImageSource } from '../assets/image-delivery.js';

test('optimized images use configured sizes, quality and allowed sources with original fallback', async () => {
  const previous = { location: globalThis.location, window: globalThis.window };
  globalThis.location = { href: 'https://story.test/', origin: 'https://story.test', protocol: 'https:' };
  globalThis.window = { innerWidth: 390 };
  try {
    const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
    const original = 'https://hyx28w95uynwxibt.public.blob.vercel-storage.com/milestones/123/photo.jpg';
    const result = new URL(optimizedImageURL(original), location.href);
    assert.equal(result.pathname, '/_vercel/image');
    assert.equal(result.searchParams.get('url'), original);
    assert.equal(result.searchParams.get('w'), '640');
    assert.ok(config.images.sizes.includes(Number(result.searchParams.get('w'))));
    assert.ok(config.images.qualities.includes(Number(result.searchParams.get('q'))));
    const allowed = config.images.remotePatterns[0];
    assert.match(new URL(original).hostname, new RegExp(allowed.hostname));
    assert.match(new URL(original).pathname, new RegExp(allowed.pathname));
    window.innerWidth = 1440;
    assert.equal(new URL(optimizedImageURL(original), location.href).searchParams.get('w'), '1080');
    const local = new URL(optimizedImageURL('/assets/montage/photo.jpg'), location.href);
    assert.equal(local.searchParams.get('url'), '/assets/montage/photo.jpg');
    assert.match(local.searchParams.get('url'), new RegExp(config.images.localPatterns[0].pathname));
    assert.equal(optimizedImageURL('https://other.test/photo.jpg'), 'https://other.test/photo.jpg');
    assert.equal(optimizedImageURL('/assets/montage/clip.mp4'), 'https://story.test/assets/montage/clip.mp4');
    const image = { getAttribute() { return this.src; } };
    let failures = 0;
    setOptimizedImageSource(image, original, 640, () => failures++);
    assert.ok(image.src.startsWith('/_vercel/image?'));
    image.onerror(); assert.equal(image.src, original); assert.equal(failures, 0);
    image.onerror(); assert.equal(failures, 1); assert.equal(image.onerror, null);
    location.protocol = 'http:';
    assert.equal(optimizedImageURL(original), original, 'local preview does not require the Vercel optimizer');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
