let state = { cycle: null, ready: false, locked: false };
export const filmPlaybackState = () => ({ ...state });
export function updateFilmPlayback({ resetCycle, together, locked }) {
  const sameCycle = state.cycle === resetCycle;
  state = { cycle: resetCycle, locked: !!locked || (sameCycle && state.locked), ready: false };
  state.ready = !!together && !state.locked;
  if (!state.ready && !state.locked) window.dispatchEvent(new Event('film-presence-left'));
}
export function stopFilmPlayback() { state.ready = false; window.dispatchEvent(new Event('film-presence-left')); }
export const canPlayFilm = () => state.ready && !state.locked && !document.hidden;
export const filmPlaybackMessage = () => state.locked
  ? 'Phim đã phát xong. Bấm Reset BK để mở lượt xem mới.'
  : 'Cần hai người cùng mở tab và giữ kết nối 5 giây để xem phim.';
export function completeFilmPlayback(cycle) {
  if (cycle !== state.cycle) return;
  state.locked = true; state.ready = false;
  window.dispatchEvent(new CustomEvent('film-complete', { detail: { cycle } }));
}
