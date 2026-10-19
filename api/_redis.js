export function redisConfigured() {
  return !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN));
}

export function redisKey(name) {
  return `${process.env.REDIS_KEY_PREFIX || 'save-the-dates'}:${name}`;
}

export async function redisCommand(command) {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!endpoint || !token) throw new Error('REDIS_NOT_CONFIGURED');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('Redis REST endpoint must use HTTPS');
  const response = await fetch(url, {
    method: 'POST', cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command), signal: AbortSignal.timeout(3000),
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error('Redis storage request failed');
  return payload.result;
}

// Compare-and-set keeps simultaneous tabs from overwriting each other's state.
// The comparison and write execute together inside Redis, across all functions.
export const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if (current or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

export async function updateRedisState(key, transition, command = redisCommand) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = await command(['GET', key]);
    const { state, result } = transition(raw === null ? null : JSON.parse(raw));
    const saved = await command(['EVAL', COMPARE_AND_SET, 1, key, raw ?? '', JSON.stringify(state)]);
    if (saved === 1) return result;
  }
  throw new Error('Redis state is busy; retry the request');
}
