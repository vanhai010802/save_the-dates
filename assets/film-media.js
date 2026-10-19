import { montageItems } from './montage-data.js';
import { optimizedImageURL } from './image-delivery.js';

const entries = new Map(), queue = [];
let active = 0;

export function filmMediaURL(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, location.href);
    if (url.protocol === 'http:' && location.protocol === 'https:') url.protocol = 'https:';
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export const getFilmMedia = url => entries.get(url)?.media;

async function download(entry) {
  const optimized = entry.type === 'video' ? entry.url : optimizedImageURL(entry.url);
  const sources = [optimized, entry.url];
  for (let attempt = 0; attempt < 2; attempt++) {
    const media = document.createElement(entry.type === 'video' ? 'video' : 'img');
    media.className = 'film-media';
    media.fetchPriority = entry.priority;
    entry.loading = media;
    if (entry.type === 'video') { media.muted = true; media.playsInline = true; media.preload = 'auto'; }
    else media.decoding = 'async';
    const ok = await new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true; clearTimeout(timeout);
        media.onload = media.onerror = media.onloadeddata = null;
        if (!value) media.removeAttribute('src');
        resolve(value);
      };
      const timeout = setTimeout(() => finish(false), 10000);
      if (entry.type === 'video') media.onloadeddata = () => finish(true);
      else media.onload = () => media.decode().catch(() => {}).then(() => finish(media.naturalWidth > 0));
      media.onerror = () => finish(false);
      media.src = sources[attempt];
    });
    if (ok) { entry.media = media; return true; }
  }
  return false;
}

function pump() {
  while (active < 4 && queue.length) {
    let urgent = queue.findIndex(entry => entry.priority === 'high');
    if (urgent < 0) urgent = queue.findIndex(entry => entry.priority === 'auto');
    // Leave bandwidth for the page and presence requests during background work.
    if (urgent < 0 && active >= 2) break;
    const [entry] = queue.splice(urgent < 0 ? 0 : urgent, 1);
    active++;
    download(entry).then(ok => {
      active--; entry.loading = null;
      if (!ok) entries.delete(entry.url);
      entry.resolve(ok); pump();
    });
  }
}

export function loadFilmMedia(url, type = 'image', priority = 'high') {
  url = filmMediaURL(url);
  if (!url) return Promise.resolve(false);
  let entry = entries.get(url);
  if (!entry) {
    entry = { url, type, priority };
    entry.promise = new Promise(resolve => { entry.resolve = resolve; });
    entries.set(url, entry); queue.push(entry);
  } else if (priority === 'high' || (priority === 'auto' && entry.priority === 'low')) {
    entry.priority = priority;
    if (entry.loading) entry.loading.fetchPriority = priority;
  }
  pump();
  return entry.promise;
}

export function warmFilmMedia({ config = {}, milestones = [] } = {}) {
  // Snapshot the current data, so a later edit cannot mix two preload batches.
  const images = [
    ...[...milestones].sort((a,b) => (a.date || '').localeCompare(b.date || '')).flatMap(memory => memory.media || []),
    ...montageItems(config.anniversary_montage),
  ].filter(media => media.type !== 'video');
  const warm = () => {
    for (const image of images) void loadFilmMedia(image.url, 'image', 'low');
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 1000 });
  else setTimeout(warm, 0);
}
