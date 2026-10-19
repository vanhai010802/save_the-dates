export const PRESENCE_TTL = 4000;
export const TOGETHER_DELAY = 5000;
export const validVisitor = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);

// Disconnect records prevent a delayed heartbeat from reviving a closed tab.
export function presencePath({ visitorId, userId, timestamp, since, active, sequence }) {
  return `presence/v2/${visitorId}/${timestamp}_${since}_${userId}_${active ? 1 : 0}_${sequence}.json`;
}
export function summarizePresence(blobs, now = Date.now()) {
  const latest = new Map(), expired = [];
  for (const blob of blobs) {
    const parts = blob.pathname.split('/');
    const match = parts[3]?.match(/^(\d{13})_(\d{13})_([a-f0-9-]{36})_([01])_(\d+)(?:-|\.json)/i);
    if (parts[0] !== 'presence' || parts[1] !== 'v2' || !validVisitor(parts[2]) || !match || !validVisitor(match[3])) {
      expired.push(blob.url); continue;
    }
    const record = { timestamp: Number(match[1]), since: Number(match[2]), userId: match[3], active: match[4] === '1', sequence: Number(match[5]), url: blob.url };
    if (record.timestamp < now - (record.active ? PRESENCE_TTL : 30000) || record.timestamp > now + 1000 || record.since > record.timestamp) { expired.push(blob.url); continue; }
    const previous = latest.get(parts[2]);
    if (!previous || previous.sequence < record.sequence || (previous.sequence === record.sequence && !record.active)) {
      if (previous) expired.push(previous.url);
      latest.set(parts[2], record);
    } else expired.push(blob.url);
  }
  const visitors = new Map([...latest].filter(([, record]) => record.active));
  const users = new Map();
  for (const record of visitors.values()) users.set(record.userId, Math.min(users.get(record.userId) ?? Infinity, record.since));
  const starts = [...users.values()].sort((a,b) => a-b);
  const togetherSince = starts.length >= 2 ? starts[1] : null;
  return { count: users.size, together: togetherSince !== null && now - togetherSince >= TOGETHER_DELAY, togetherSince, expired, visitors, latest };
}
