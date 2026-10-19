const BLOB_HOST = 'hyx28w95uynwxibt.public.blob.vercel-storage.com';

export function optimizedImageURL(value, width = window.innerWidth <= 640 ? 640 : 1080) {
  try {
    const url = new URL(value, location.href);
    if (location.protocol !== 'https:') return url.href;
    if (url.protocol === 'http:') url.protocol = 'https:';
    const bundled = url.origin === location.origin && url.pathname.startsWith('/assets/montage/');
    const uploaded = url.hostname === BLOB_HOST && /^\/(milestones|avatars)\//.test(url.pathname);
    if ((!bundled && !uploaded) || !/\.(jpe?g|png|webp|avif)$/i.test(url.pathname)) return url.href;
    const source = bundled ? url.pathname : url.href;
    return `/_vercel/image?${new URLSearchParams({ url: source, w: String(width <= 640 ? 640 : 1080), q: '70' })}`;
  } catch { return ''; }
}

export function setOptimizedImageSource(image, original, width, onError) {
  const optimized = optimizedImageURL(original, width);
  image.onerror = () => {
    if (optimized && image.getAttribute('src') === optimized && optimized.startsWith('/_vercel/image?')) {
      image.src = original;
    } else { image.onerror = null; onError?.(); }
  };
  image.src = optimized;
}
