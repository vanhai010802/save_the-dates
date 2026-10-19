const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/gi;
export function celebrationState(blobs) {
  const resets=blobs.map(blob=>blob.pathname.match(/^celebration\/resets\/(\d{13}_[a-f0-9-]{36})\.json$/i)?.[1]).filter(Boolean).sort();
  const cycle=resets.at(-1) || 'initial';
  const events=blobs.filter(blob=>blob.pathname.startsWith(`celebration/events/${cycle}/`)).sort((a,b)=>a.pathname.localeCompare(b.pathname));
  const event=events[0];
  const locked=blobs.some(blob=>blob.pathname.startsWith(`celebration/completed/${cycle}/`));
  return {cycle,locked,resetAt:cycle==='initial'?0:Number(cycle.split('_')[0]),fired:!!event,targets:event ? (event.pathname.split('/').at(-1).match(uuidPattern) || []) : []};
}

export function celebrationPresence(state, presence, visitorId, active, now=Date.now()) {
  const since=presence.togetherSince===null?null:Math.max(presence.togetherSince,state.resetAt);
  return {count:presence.count,cycle:`${state.cycle}:${since ?? 'waiting'}`,resetCycle:state.cycle,locked:state.locked,
    together:!!active && !state.locked && presence.visitors.has(visitorId) && since!==null && now-since>=5000};
}
