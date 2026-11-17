import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { transitionPresence } from '../api/_presence-state.js';
import { updateRedisState, redisCommand, redisKey } from '../api/_redis.js';
import handler from '../api/presence.js';

const a={visitorId:randomUUID(),userId:randomUUID(),active:true,sequence:1};
const b={visitorId:randomUUID(),userId:randomUUID(),active:true,sequence:1};
const now=1800000000000;
test('Redis state preserves the online hold, tab deduplication, disconnect ordering and playback lock',()=>{
  let state=transitionPresence(null,{action:'reset'},now,'cycle-one').state;
  const pulse=(body,time)=>{const next=transitionPresence(state,body,time);state=next.state;return next.result;};
  assert.equal(pulse(a,now).together,false);
  assert.equal(pulse({...a,visitorId:randomUUID()},now).count,1);
  pulse(b,now);
  for(let i=1;i<=5;i++){
    pulse({...a,sequence:i+1},now+i*1000);
    const result=pulse({...b,sequence:i+1},now+i*1000);
    assert.equal(result.together,i===5);
  }
  assert.equal(pulse({...b,active:false,sequence:8},now+5100).together,false);
  assert.equal(pulse({...b,sequence:7},now+5200).together,false,'late heartbeat cannot undo a newer disconnect');
  pulse({...b,sequence:9},now+5300);
  const done=pulse({...a,sequence:10,action:'complete',resetCycle:'cycle-one'},now+5400);
  assert.equal(done.locked,true);
  assert.equal(pulse({...a,sequence:11},now+5500).together,false);
  state=transitionPresence(state,{action:'reset'},now+6000,'cycle-two').state;
  assert.equal(pulse({...a,sequence:12,action:'complete',resetCycle:'cycle-one'},now+6001).locked,false,'old completion cannot lock a new reset');
  assert.equal(pulse({...a,sequence:13},now+12000).count,1,'expired visitors are removed');
});
test('missing database starts locked until Reset BK',()=>{
  assert.equal(transitionPresence(null,a,now).result.locked,true);
});
test('compare-and-set retries contention without losing another visitor',async()=>{
  let raw=null,conflicted=false;
  const command=async args=>{
    if(args[0]==='GET')return raw;
    assert.equal(args[0],'EVAL');
    if(!conflicted){raw=JSON.stringify({other:true});conflicted=true;return 0;}
    assert.equal(args[4],raw);
    raw=args[5];return 1;
  };
  const result=await updateRedisState('state',value=>({state:{...value,me:true},result:'saved'}),command);
  assert.equal(result,'saved');assert.deepEqual(JSON.parse(raw),{other:true,me:true});
});
test('retired presence makes no storage calls, including cached reset requests',async()=>{
  const savedFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Retired presence must never access storage');};
  try{
    for(const body of [a,b,{action:'reset'}]){
      const response={setHeader(){return this;},status(code){this.statusCode=code;return this;},end(raw){this.body=JSON.parse(raw);}};
      await handler({method:'POST',body,headers:{}},response);
      assert.equal(response.statusCode,410);
      assert.equal(response.body.retired,true);
      assert.equal(response.body.code,'PRESENCE_NOT_CONFIGURED');
    }
  }finally{globalThis.fetch=savedFetch;}
});
