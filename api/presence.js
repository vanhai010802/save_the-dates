import { put, list, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { readJsonBody, sendJson, handleError, HttpError, verifyPassword } from './_lib.js';
import { summarizePresence, validVisitor, presencePath, PRESENCE_TTL } from './_presence.js';
import { celebrationState } from './_celebration.js';

async function listPrefix(prefix) {
  const blobs=[];let cursor;
  do{const page=await list({prefix,limit:1000,cursor});blobs.push(...page.blobs);cursor=page.cursor;}while(cursor);
  return blobs;
}
async function marker(pathname) {
  return put(pathname,'{}',{access:'public',addRandomSuffix:false,contentType:'application/json',cacheControlMaxAge:60});
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const body = await readJsonBody(req);
    if(body.action==='reset'){
      verifyPassword(req);
      const cycle=`${Date.now()}_${randomUUID()}`;
      await marker(`celebration/resets/${cycle}.json`);
      sendJson(res,200,{ok:true,cycle});return;
    }
    if (!validVisitor(body.visitorId) || !validVisitor(body.userId)) throw new HttpError(400, 'Thiết bị không hợp lệ');
    if (body.active !== true && body.active !== false) throw new HttpError(400, 'Trạng thái không hợp lệ');
    const now = Date.now();
    if (!Number.isSafeInteger(body.sequence) || body.sequence < 1) throw new HttpError(400, 'Nhịp kết nối đã hết hạn');
    const before = summarizePresence(await listPrefix('presence/'), now);
    const previous = before.latest.get(body.visitorId);
    const since = previous?.active && previous.userId === body.userId && now - previous.timestamp < PRESENCE_TTL ? previous.since : now;
    if (!previous || previous.sequence < body.sequence) await put(presencePath({ ...body, timestamp: now, since }), '{}', {
      access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60,
    });
    const blobs = await listPrefix('presence/');
    const result = summarizePresence(blobs);
    const cleanup = [...new Set(result.expired)];
    if (cleanup.length) {
      try { await del(cleanup); } catch (error) { console.error('Presence cleanup failed:', error); }
    }
    const celebration=celebrationState(await listPrefix('celebration/'));
    sendJson(res, 200, {count:result.count,cycle:`${celebration.cycle}:${result.togetherSince ?? 'waiting'}`,together:body.active && result.visitors.has(body.visitorId) && result.together});
  } catch (error) { handleError(res, error); }
}
