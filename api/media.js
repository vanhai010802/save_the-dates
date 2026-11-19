import { handleError, HttpError } from './_lib.js';
import { getR2DownloadURL, isMediaKey, r2Storage } from './_r2.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    const key = new URL(req.url, 'http://localhost').searchParams.get('key');
    if (!isMediaKey(key)) throw new HttpError(400, 'Đường dẫn tệp không hợp lệ');
    const r2 = r2Storage();
    if (!r2) throw new HttpError(503, 'Server chưa cấu hình Cloudflare R2');
    res.setHeader('Location', await getR2DownloadURL(r2, key, req.method));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(307).end();
  } catch (err) {
    handleError(res, err);
  }
}
