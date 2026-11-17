import { put, list, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';
import { redisConfigured, redisCommand, redisKey } from './_redis.js';

// Mỗi write data sinh 1 pathname random (data-<hash>.json) thay vì cố định
// "data.json". Vercel Blob CDN cache rất "dính" theo URL: nếu put đè cùng path
// thì subsequent reads vẫn lấy bản cũ cho đến khi cache TTL hết. Random suffix
// → URL mới mỗi lần → đọc luôn fresh. Sau khi ghi xong sẽ xóa các bản cũ.
const DATA_PREFIX = 'data-';
const DATA_SUFFIX = '.json';
// The current original JSON URL is known from the owner's store. Read it
// directly; listing on every page load would spend Advanced Operations.
let storyBlobURL = process.env.STORY_BLOB_URL || 'https://hyx28w95uynwxibt.public.blob.vercel-storage.com/data-v-B3rCs7sJxUbv1CzTaUodj6qGrjfgPC.json';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function verifyPassword(req) {
  const provided = req.headers['x-admin-password'] || '';
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected) {
    throw new HttpError(500, 'Server chưa cấu hình ADMIN_PASSWORD');
  }
  const a = Buffer.from(String(provided));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, 'Sai mật khẩu');
  }
}

async function listDataBlobs() {
  const all = [];
  let cursor;
  do {
    const page = await list({ prefix: DATA_PREFIX, cursor, limit: 1000 });
    for (const b of page.blobs) {
      if (b.pathname.endsWith(DATA_SUFFIX)) all.push(b);
    }
    cursor = page.cursor;
  } while (cursor);
  return all.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function readData() {
  try {
    if (redisConfigured()) {
      const stored = await redisCommand(['GET', redisKey('story:v1')]);
      if (stored !== null) return JSON.parse(stored);
    }
    let res = await fetch(storyBlobURL, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if(res.status===404){
      const blobs=await listDataBlobs();
      if(!blobs.length)throw new HttpError(503,'Không tìm thấy dữ liệu gốc. Chưa tạo dữ liệu thay thế.','STORY_NOT_FOUND');
      storyBlobURL=blobs[0].url;
      res=await fetch(storyBlobURL,{cache:'no-store',signal:AbortSignal.timeout(8000)});
    }
    if (res.status === 403) throw new HttpError(503, 'Kho dữ liệu đang bị Vercel chặn do vượt hạn mức. Cần mở lại quyền truy cập kho để khôi phục dữ liệu.', 'BLOB_STORE_BLOCKED');
    if (!res.ok) throw new HttpError(502, `Không đọc được data: ${res.status}`);
    const json = await res.json();
    const data = {
      config: json.config || {},
      milestones: Array.isArray(json.milestones) ? json.milestones : [],
      unlocked: !!json.unlocked,
      unlocked_at: json.unlocked_at || null,
    };
    if (redisConfigured()) {
      const inserted = await redisCommand(['SET', redisKey('story:v1'), JSON.stringify(data), 'NX']);
      // Another request may already have migrated and edited the story.
      if (inserted === null) return JSON.parse(await redisCommand(['GET', redisKey('story:v1')]));
    }
    return data;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      throw new HttpError(500, 'Server chưa cấu hình BLOB_READ_WRITE_TOKEN');
    }
    throw err;
  }
}

export async function writeData(data) {
  if (redisConfigured()) {
    await redisCommand(['SET', redisKey('story:v1'), JSON.stringify(data)]);
    return;
  }
  // Lấy danh sách bản cũ trước, viết bản mới, rồi xóa bản cũ.
  const oldBlobs = await listDataBlobs();
  const written = await put(DATA_PREFIX + 'v' + DATA_SUFFIX, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: true,
    cacheControlMaxAge: 0,
  });
  storyBlobURL=written.url;
  if (oldBlobs.length > 0) {
    try { await del(oldBlobs.map(b => b.url)); }
    catch (e) { console.error('Cleanup old data blobs failed:', e); }
  }
}

export async function deletePrefix(prefix) {
  const urls = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    urls.push(...page.blobs.map(b => b.url));
    cursor = page.cursor;
  } while (cursor);
  if (urls.length) await del(urls);
}

export function sendJson(res, status, body) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function handleError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof HttpError ? err.message : 'Lỗi server không rõ';
  if (!(err instanceof HttpError)) console.error('Unexpected:', err);
  sendJson(res, status, { error: message, ...(err.code ? { code: err.code } : {}) });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw new HttpError(400, 'Body không phải JSON hợp lệ'); }
}
