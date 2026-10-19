const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/gi;
export function celebrationState(blobs) {
  const resets=blobs.map(blob=>blob.pathname.match(/^celebration\/resets\/(\d{13}_[a-f0-9-]{36})\.json$/i)?.[1]).filter(Boolean).sort();
  const cycle=resets.at(-1) || 'initial';
  const events=blobs.filter(blob=>blob.pathname.startsWith(`celebration/events/${cycle}/`)).sort((a,b)=>a.pathname.localeCompare(b.pathname));
  const event=events[0];
  return {cycle,fired:!!event,targets:event ? (event.pathname.split('/').at(-1).match(uuidPattern) || []) : []};
}
