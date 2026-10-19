import { PRESENCE_TTL, TOGETHER_DELAY } from './_presence.js';

export function transitionPresence(current, body, now, newCycle) {
  // A newly connected database starts locked; Reset BK explicitly starts a new
  // cycle instead of accidentally replaying a film completed before migration.
  const state = current ? structuredClone(current) : { cycle: 'initial', resetAt: 0, locked: true, visitors: {} };
  for (const [id, visitor] of Object.entries(state.visitors)) {
    if (now - visitor.timestamp > (visitor.active ? PRESENCE_TTL : 30000)) delete state.visitors[id];
  }
  if (body.action === 'reset') {
    state.cycle = newCycle; state.resetAt = now; state.locked = false;
    return { state, result: { ok: true, cycle: newCycle } };
  }
  const previous = state.visitors[body.visitorId];
  if (!previous || previous.sequence < body.sequence) {
    state.visitors[body.visitorId] = {
      userId: body.userId, sequence: body.sequence, timestamp: now, active: body.active,
      since: previous?.active && previous.userId === body.userId ? previous.since : now,
    };
  }
  const me = state.visitors[body.visitorId];
  if (body.action === 'complete' && body.resetCycle === state.cycle && me?.active && me.userId === body.userId) state.locked = true;
  const users = new Map();
  for (const visitor of Object.values(state.visitors)) {
    if (visitor.active) users.set(visitor.userId, Math.min(users.get(visitor.userId) ?? Infinity, visitor.since));
  }
  const starts = [...users.values()].sort((a,b) => a-b);
  const since = starts.length >= 2 ? Math.max(starts[1], state.resetAt) : null;
  return { state, result: {
    count: users.size, cycle: `${state.cycle}:${since ?? 'waiting'}`, resetCycle: state.cycle, locked: state.locked,
    together: body.active && !!me?.active && !state.locked && since !== null && now-since >= TOGETHER_DELAY,
  } };
}
