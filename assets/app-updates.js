// Independent of the application's module graph, including Safari-restored pages.
(() => {
  const current = document.querySelector('meta[name="app-version"]')?.content;
  if (!/^[a-f0-9]{16}$/.test(current || '')) return;
  let checking = false, reloading = false, pending = '';

  function applyUpdate() {
    if (!pending || reloading || document.hidden) return;
    if (document.querySelector('dialog[open], #drawer:not([hidden])')) return;
    if (document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) return;
    const target = new URL(location.href);
    // A stale intermediary must not cause an endless refresh loop.
    if (target.searchParams.get('__app_version') === pending) return;
    target.searchParams.set('__app_version', pending);
    reloading = true;
    location.replace(target.href);
  }

  async function check() {
    if (checking || reloading || document.hidden) return;
    checking = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
      if (!response.ok) return;
      const {version} = await response.json();
      if (!/^[a-f0-9]{16}$/.test(version || '')) return;
      pending = version === current ? '' : version;
      applyUpdate();
    } catch { /* Keep the current page usable when offline. */ }
    finally { clearTimeout(timeout); checking = false; }
  }

  window.addEventListener('pageshow', check);
  window.addEventListener('focus', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', check);
  document.addEventListener('close', () => setTimeout(applyUpdate, 0), true);
  document.addEventListener('focusout', () => setTimeout(applyUpdate, 0));
  new MutationObserver(applyUpdate).observe(document.body, {subtree:true, attributes:true, attributeFilter:['open','hidden']});
  setInterval(check, 60000);
  void check();
})();
