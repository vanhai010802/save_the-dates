import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { summarizePresence, presencePath, PRESENCE_TTL } from '../api/_presence.js';
const now=1800000000000;
const user1=randomUUID(),user2=randomUUID();
function record(userId,{visitorId=randomUUID(),timestamp=now,since=now-5000,active=true,sequence=1}={}){
  const pathname=presencePath({visitorId,userId,timestamp,since,active,sequence});return {pathname,url:pathname};
}
test('requires two distinct users continuously present for five seconds',()=>{
  assert.equal(summarizePresence([record(user1)],now).together,false);
  const waiting=[record(user1),record(user2,{since:now-4999})];
  assert.equal(summarizePresence(waiting,now).together,false);
  assert.equal(summarizePresence(waiting,now+1).together,true);
});
test('duplicate tabs from one user do not open the cake',()=>{
  const state=summarizePresence([record(user1),record(user1)],now);
  assert.equal(state.count,1);assert.equal(state.together,false);
});
test('disconnect wins over delayed and same-millisecond heartbeats',()=>{
  const visitorId=randomUUID();
  const old=record(user2,{visitorId,timestamp:now-1,sequence:1});
  const leave=record(user2,{visitorId,active:false,sequence:3});
  const late=record(user2,{visitorId,sequence:2});
  for(const records of [[leave,old,late],[old,late,leave]]){
    const state=summarizePresence([record(user1),...records],now);
    assert.equal(state.count,1);assert.equal(state.together,false);
  }
});
test('lost connections expire after four seconds',()=>{
  const state=summarizePresence([record(user1),record(user2,{timestamp:now-PRESENCE_TTL-1,since:now-9000})],now);
  assert.equal(state.count,1);assert.equal(state.together,false);
});
test('returning user starts a new five-second wait and cycle',()=>{
  const first=summarizePresence([record(user1),record(user2)],now);
  const returning=summarizePresence([record(user1),record(user2,{since:now})],now);
  assert.notEqual(first.togetherSince,returning.togetherSince);assert.equal(returning.together,false);
});

test('disconnect sequence wins even if an older request finishes later',()=>{
  const visitorId=randomUUID();
  const leave=record(user2,{visitorId,active:false,sequence:3,timestamp:now-1});
  const late=record(user2,{visitorId,sequence:2,timestamp:now});
  assert.equal(summarizePresence([record(user1),leave,late],now).together,false);
});
