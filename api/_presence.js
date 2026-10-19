export const PRESENCE_TTL = 90000;
export const validVisitor = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);

// Each device gets its own immutable heartbeat. Never overwrite the love-story
// data file: simultaneous heartbeats must not lose either visitor's presence.
export function summarizePresence(blobs, now = Date.now()) {
  const latest = new Map(), expired = [];
  for (const blob of blobs) {
    const parts = blob.pathname.split('/');
    const timestamp = Number(parts[2]?.match(/^(\d{13})(?:-|\.json)/)?.[1]);
    if (parts[0] !== 'presence' || !validVisitor(parts[1]) || !Number.isFinite(timestamp) || timestamp < now - PRESENCE_TTL || timestamp > now + 5000) {
      expired.push(blob.url); continue;
    }
    const previous = latest.get(parts[1]);
    if (!previous || previous.timestamp < timestamp) {
      if (previous) expired.push(previous.url);
      latest.set(parts[1], { timestamp, url: blob.url });
    } else expired.push(blob.url);
  }
  return { count: latest.size, together: latest.size >= 2, expired, visitors: latest };
}
