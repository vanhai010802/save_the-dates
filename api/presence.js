import { randomUUID } from 'node:crypto';
import { readJsonBody, sendJson, handleError, HttpError, verifyPassword } from './_lib.js';
import { validVisitor } from './_presence.js';
import { redisConfigured, redisKey, updateRedisState } from './_redis.js';
import { transitionPresence } from './_presence-state.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed');
    const body = await readJsonBody(req);
    if (body.action === 'reset') verifyPassword(req);
    else {
      if (!validVisitor(body.visitorId) || !validVisitor(body.userId)) throw new HttpError(400, 'Thiết bị không hợp lệ');
      if (typeof body.active !== 'boolean' || !Number.isSafeInteger(body.sequence) || body.sequence < 1) throw new HttpError(400, 'Trạng thái không hợp lệ');
    }
    // Never fall back to Blob for heartbeats: that exhausted Advanced Operations.
    if (!redisConfigured()) {
      sendJson(res, 503, { code: 'PRESENCE_NOT_CONFIGURED', error: 'Tính năng xem chung đang chờ cấu hình kho trạng thái mới.' });
      return;
    }
    const cycle = `${Date.now()}_${randomUUID()}`;
    const result = await updateRedisState(redisKey('presence:v1'), state => transitionPresence(state, body, Date.now(), cycle));
    sendJson(res, 200, result);
  } catch (error) { handleError(res, error); }
}
