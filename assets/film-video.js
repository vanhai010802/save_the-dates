// iOS can withhold loadeddata until a visible video is actually played.
// Mount first, then load/play; never use a detached preload as a prerequisite.
export function createFilmVideo(url, { isCurrent, isPlaying, onDuration, onStatus }) {
  const element = document.createElement('video');
  element.className = 'film-media';
  element.muted = element.defaultMuted = true;
  element.playsInline = true;
  element.setAttribute('muted', '');
  element.setAttribute('playsinline', '');
  element.setAttribute('webkit-playsinline', '');
  element.preload = 'metadata';
  let mounted = false, disposed = false, timer, pendingSeek = 0;
  const listeners = [];
  const listen = (name, fn) => { element.addEventListener(name, fn); listeners.push([name, fn]); };
  const current = () => !disposed && isCurrent();
  const status = (kind, message) => { if (current()) onStatus(kind, message); };
  const offerPlay = (kind, message) => {
    clearTimeout(timer);
    if (!current()) return;
    element.controls = true;
    status(kind, message);
  };
  const wait = () => {
    clearTimeout(timer);
    timer = setTimeout(() => offerPlay('retry', 'Video tải lâu hơn dự kiến. Chạm để thử lại.'), 15000);
  };
  function seek() {
    if (!Number.isFinite(element.duration) || element.duration <= 0) return;
    onDuration(element.duration);
    if (pendingSeek !== null) {
      try { element.currentTime = Math.min(pendingSeek, Math.max(0, element.duration - .1)); pendingSeek = null; } catch {}
    }
  }
  function play() {
    if (!mounted || !current()) return;
    wait();
    if (element.error) { pendingSeek = element.currentTime || 0; element.load(); }
    try {
      // Invoke synchronously so tapping the fallback preserves the user gesture.
      const attempt = element.play();
      attempt?.catch(error => {
        if (!current() || !isPlaying() || error.name === 'AbortError') return;
        offerPlay(error.name === 'NotAllowedError' ? 'blocked' : 'retry', error.name === 'NotAllowedError'
          ? 'Chạm để phát video trên thiết bị này.'
          : 'Chưa phát được video. Chạm để thử lại.');
      });
    } catch { offerPlay('retry', 'Chưa phát được video. Chạm để thử lại.'); }
  }
  listen('loadedmetadata', seek);
  listen('durationchange', seek);
  listen('playing', () => { clearTimeout(timer); status('ready', ''); });
  listen('waiting', wait);
  listen('stalled', wait);
  listen('error', () => offerPlay('retry', 'Chưa tải được video. Chạm để thử lại hoặc mở video riêng.'));
  listen('pause', () => {
    if (mounted && current() && isPlaying() && !element.ended) offerPlay('blocked', 'Chạm để tiếp tục video.');
  });
  return {
    element,
    mount(position = 0) {
      if (mounted || !current()) return;
      mounted = true; pendingSeek = position;
      element.src = url;
      status('loading', 'Đang tải video…');
      element.load();
      if (isPlaying()) play();
    },
    play,
    pause() { clearTimeout(timer); element.pause(); },
    dispose() {
      disposed = true; clearTimeout(timer);
      for (const [name, fn] of listeners) element.removeEventListener(name, fn);
      element.pause();
    },
  };
}
