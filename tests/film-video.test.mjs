import test from 'node:test';
import assert from 'node:assert/strict';
import { createFilmVideo } from '../assets/film-video.js';

class Video extends EventTarget {
  src = '';
  duration = 8.148;
  currentTime = 0;
  error = null;
  calls = [];
  allowed = false;
  attributes = new Map();
  setAttribute(name, value) { this.attributes.set(name, value); }
  load() {
    this.calls.push('load'); this.error = null;
    // Model iPhone's metadata-only preload: loadeddata never fires here.
    this.dispatchEvent(new Event('loadedmetadata'));
  }
  play() {
    this.calls.push('play');
    if (!this.allowed) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.calls.push('pause'); this.dispatchEvent(new Event('pause')); }
}

test('metadata-only iPhone preload does not prevent mounting; a blocked clip can play after a tap', async () => {
  const previous = globalThis.document, video = new Video(), states = [], durations = [];
  globalThis.document = { createElement: () => video };
  let playing = true;
  const clip = createFilmVideo('/clip.mp4', {
    isCurrent: () => true, isPlaying: () => playing,
    onDuration: duration => durations.push(duration), onStatus: (kind, message) => states.push({kind, message}),
  });
  try {
    assert.equal(video.src, '', 'no offscreen request before mount');
    clip.mount(2);
    await Promise.resolve();
    assert.equal(video.src, '/clip.mp4');
    assert.equal(video.currentTime, 2, 'seeks only after metadata is available');
    assert.deepEqual(durations, [8.148]);
    assert.deepEqual(video.calls, ['load', 'play'], 'play starts without waiting for loadeddata');
    assert.equal(states.at(-1).kind, 'blocked');
    assert.equal(video.controls, true);
    assert.equal(video.muted, true);
    assert.equal(video.defaultMuted, true);
    assert.ok(video.attributes.has('playsinline'));
    video.allowed = true;
    clip.play();
    assert.equal(states.at(-1).kind, 'ready');
    playing = false;
    clip.pause();
    assert.equal(states.at(-1).kind, 'ready', 'intentional film pause does not show an autoplay error');
    video.error = {code: 2};
    video.dispatchEvent(new Event('error'));
    assert.equal(states.at(-1).kind, 'retry');
    playing = true;
    clip.play();
    assert.equal(video.calls.filter(call => call === 'load').length, 2, 'retry restarts a failed network load');
    assert.equal(states.at(-1).kind, 'ready');
  } finally {
    clip.dispose();
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});

test('navigation disposes a pending video and ignores its late playback rejection', async () => {
  const previous = globalThis.document, video = new Video(), states = [];
  globalThis.document = { createElement: () => video };
  let rejectPlay;
  video.play = () => new Promise((resolve, reject) => { rejectPlay = reject; });
  const clip = createFilmVideo('/late.mp4', {
    isCurrent: () => true, isPlaying: () => true, onDuration() {}, onStatus: kind => states.push(kind),
  });
  try {
    clip.mount();
    clip.dispose();
    const count = states.length;
    rejectPlay(new DOMException('Gesture required', 'NotAllowedError'));
    video.dispatchEvent(new Event('error'));
    await Promise.resolve();
    assert.equal(states.length, count, 'old events cannot change the next scene');
  } finally {
    clip.dispose();
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});
