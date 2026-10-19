import { put, list, del } from '@vercel/blob';
import { readJsonBody, sendJson, handleError, HttpError } from './_lib.js';
import { summarizePresence, validVisitor } from './_presence.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const body = await readJsonBody(req);
    if (!validVisitor(body.visitorId)) throw new HttpError(400, 'Thiết bị không hợp lệ');
    if (body.active !== true && body.active !== false) throw new HttpError(400, 'Trạng thái không hợp lệ');
    // A fresh pathname avoids CDN caches and concurrent whole-file writes.
    if (body.active) await put(`presence/${body.visitorId}/${Date.now()}.json`, '{}', {
      access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60,
    });
    const blobs = []; let cursor;
    do {
      const page = await list({ prefix: 'presence/', limit: 1000, cursor });
      blobs.push(...page.blobs); cursor = page.cursor;
    } while (cursor);
    const leaving = body.active ? [] : blobs.filter(b => b.pathname.startsWith(`presence/${body.visitorId}/`));
    const result = summarizePresence(blobs.filter(b => !leaving.includes(b)));
    const cleanup = [...new Set([...result.expired, ...leaving.map(b => b.url)])];
    if (cleanup.length) {
      try { await del(cleanup); } catch (error) { console.error('Presence cleanup failed:', error); }
    }
    sendJson(res, 200, { count: result.count, together: result.together });
  } catch (error) { handleError(res, error); }
}
