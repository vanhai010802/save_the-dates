import test from 'node:test';
import assert from 'node:assert/strict';

test('background warming shares downloads, limits concurrency and prioritizes playback', async () => {
  const previous = { document: globalThis.document, window: globalThis.window, location: globalThis.location };
  const requests = [], idle = [];
  globalThis.location = { href: 'https://example.test/', protocol: 'https:' };
  globalThis.window = { requestIdleCallback: callback => idle.push(callback) };
  globalThis.document = { createElement(tag) {
    return {
      tagName: tag.toUpperCase(), naturalWidth: 100,
      decode: async () => {}, removeAttribute() {},
      set src(url) { this.url = url; requests.push(this); },
    };
  } };
  try {
    const { warmFilmMedia, loadFilmMedia, getFilmMedia, filmMediaURL } = await import('../assets/film-media.js');
    const finish = async (name, ok = true) => {
      const request = requests.findLast(item => item.url.endsWith(name));
      assert.ok(request);
      if (!ok) request.onerror();
      else if (request.tagName === 'VIDEO') request.onloadeddata();
      else request.onload();
      await new Promise(resolve => setImmediate(resolve));
    };
    warmFilmMedia({ milestones: [
      { date: '2026-02-01', media: [{ url: '/3.jpg' }, { url: '/4.jpg' }, { url: '/clip.mp4', type: 'video' }] },
      { date: '2026-01-01', media: [{ url: '/1.jpg' }, { url: '/2.jpg' }, { url: '/1.jpg' }] },
    ] });
    assert.equal(requests.length, 0, 'waits for idle so the page can render');
    idle.shift()();
    assert.deepEqual(requests.map(item => item.url), ['https://example.test/1.jpg', 'https://example.test/2.jpg']);
    assert.ok(requests.every(item => item.fetchPriority === 'low'));
    const pending = loadFilmMedia('/1.jpg');
    assert.equal(requests.length, 2, 'reuses a background request already in flight');
    assert.equal(requests[0].fetchPriority, 'high');
    const promoted = loadFilmMedia('/3.jpg');
    const added = loadFilmMedia('/5.jpg');
    assert.equal(requests.length, 4);
    assert.equal(requests[2].url, 'https://example.test/3.jpg');
    await finish('/1.jpg'); await finish('/2.jpg');
    assert.equal(requests.length, 4, 'background work stays below the background concurrency limit');
    await finish('/3.jpg');
    assert.equal(requests[4].url, 'https://example.test/4.jpg');
    await finish('/5.jpg'); await finish('/4.jpg');
    assert.deepEqual(await Promise.all([pending, promoted, added]), [true, true, true]);
    assert.ok(getFilmMedia('https://example.test/1.jpg'));
    assert.equal(await loadFilmMedia('/1.jpg'), true);
    assert.equal(requests.length, 5, 'ready images are reused without another download');
    assert.equal(requests.some(item => item.tagName === 'VIDEO'), false);

    const video = loadFilmMedia('/clip.mp4', 'video');
    await finish('/clip.mp4'); assert.equal(await video, true);
    const broken = loadFilmMedia('/broken.jpg');
    await finish('/broken.jpg', false); await finish('/broken.jpg', false);
    assert.equal(await broken, false);
    assert.equal(requests.filter(item => item.url.endsWith('/broken.jpg')).length, 2);
    const retry = loadFilmMedia('/broken.jpg');
    await finish('/broken.jpg'); assert.equal(await retry, true);
    assert.equal(filmMediaURL(undefined), '');
    assert.equal(filmMediaURL('javascript:alert(1)'), '');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
