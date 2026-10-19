import { put, list, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { readJsonBody, sendJson, handleError, HttpError, verifyPassword } from './_lib.js';
import { summarizePresence, validVisitor } from './_presence.js';
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
    if (!validVisitor(body.visitorId)) throw new HttpError(400, 'Thiết bị không hợp lệ');
    if (body.active !== true && body.active !== false) throw new HttpError(400, 'Trạng thái không hợp lệ');
    // A fresh pathname avoids CDN caches and concurrent whole-file writes.
    if (body.active) await put(`presence/${body.visitorId}/${Date.now()}.json`, '{}', {
      access: 'public', addRandomSuffix: true, contentType: 'application/json', cacheControlMaxAge: 60,
    });
    const blobs = await listPrefix('presence/');
    const leaving = body.active ? [] : blobs.filter(b => b.pathname.startsWith(`presence/${body.visitorId}/`));
    const result = summarizePresence(blobs.filter(b => !leaving.includes(b)));
    const cleanup = [...new Set([...result.expired, ...leaving.map(b => b.url)])];
    if (cleanup.length) {
      try { await del(cleanup); } catch (error) { console.error('Presence cleanup failed:', error); }
    }
    let celebration=celebrationState(await listPrefix('celebration/'));
    if(body.active && result.together && !celebration.fired){
      const targets=[...result.visitors.keys()].sort();
      await marker(`celebration/events/${celebration.cycle}/${Date.now()}_${targets.join('_')}.json`);
      celebration=celebrationState(await listPrefix('celebration/'));
    }
    sendJson(res, 200, {count:result.count,cycle:celebration.cycle,fired:celebration.fired,together:body.active && celebration.targets.includes(body.visitorId)});
  } catch (error) { handleError(res, error); }
}
