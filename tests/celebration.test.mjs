import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { celebrationState, celebrationPresence } from '../api/_celebration.js';

test('completion locks a reset cycle across reloads and a new reset clears it', () => {
  const completed={pathname:`celebration/completed/initial/${randomUUID()}.json`};
  assert.equal(celebrationState([completed]).locked,true);
  assert.equal(celebrationState([{...completed}]).locked,true);
  const cycle=`1800000000000_${randomUUID()}`;
  const reset={pathname:`celebration/resets/${cycle}.json`};
  const next=celebrationState([completed,reset]);
  assert.equal(next.cycle,cycle);assert.equal(next.locked,false);
  assert.equal(celebrationState([completed,reset,{pathname:`celebration/completed/${cycle}/${randomUUID()}.json`}]).locked,true);
});
test('reset requires a new five-second online hold and locked films cannot reopen', () => {
  const visitorId=randomUUID(),now=1800000000000;
  const online={count:2,togetherSince:now-10000,visitors:new Map([[visitorId,{}]])};
  const state={cycle:`${now}_${randomUUID()}`,resetAt:now,locked:false};
  assert.equal(celebrationPresence(state,online,visitorId,true,now+4999).together,false);
  assert.equal(celebrationPresence(state,online,visitorId,true,now+5000).together,true);
  assert.equal(celebrationPresence({...state,locked:true},online,visitorId,true,now+5000).together,false);
  assert.equal(celebrationPresence(state,{...online,count:1,togetherSince:null},visitorId,true,now+10000).together,false);
  assert.equal(celebrationPresence(state,online,visitorId,false,now+10000).together,false);
});
