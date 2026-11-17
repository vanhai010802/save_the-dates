// Retired endpoint: cached clients never write heartbeats to Blob or Redis.
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(410).end(JSON.stringify({code:'PRESENCE_NOT_CONFIGURED',retired:true}));
}
