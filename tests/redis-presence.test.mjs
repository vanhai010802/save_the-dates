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
test('production presence uses only Redis and pauses safely without configuration',async()=>{
  const savedFetch=globalThis.fetch,oldNow=Date.now;
  const envKeys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN','ADMIN_PASSWORD'];
  const savedEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
  const store=new Map();let clock=now,requests=0;
  const request=async(body,password)=>{
    const response={statusCode:200,setHeader(){return this;},status(code){this.statusCode=code;return this;},end(raw){this.body=JSON.parse(raw);}};
    await handler({method:'POST',body,headers:{'x-admin-password':password}},response);return response;
  };
  try{
    for(const key of envKeys)delete process.env[key];
    assert.equal((await request(a)).body.code,'PRESENCE_NOT_CONFIGURED');
    process.env.UPSTASH_REDIS_REST_URL='https://redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='test-only-token';process.env.ADMIN_PASSWORD='test-password';
    Date.now=()=>clock;
    globalThis.fetch=async(url,options)=>{
      assert.equal(new URL(url).hostname,'redis.test','no Blob API calls are allowed');requests++;
      assert.equal(options.headers.authorization,'Bearer test-only-token');
      const args=JSON.parse(options.body);let result;
      if(args[0]==='GET')result=store.get(args[1])??null;
      else if(args[0]==='EVAL'){
        const current=store.get(args[3])??'';
        result=current===args[4]?1:0;if(result)store.set(args[3],args[5]);
      }else throw Error('Unexpected command');
      return new Response(JSON.stringify({result}),{status:200});
    };
    assert.equal((await request({action:'reset'},'wrong')).statusCode,401);
    const reset=await request({action:'reset'},'test-password');assert.equal(reset.statusCode,200);
    await request(a);await request(b);
    for(let i=1;i<=5;i++){clock=now+i*1000;await request({...a,sequence:i+1});const response=await request({...b,sequence:i+1});assert.equal(response.body.together,i===5);}
    assert.equal((await request({...a,sequence:7,action:'complete',resetCycle:reset.body.cycle})).body.locked,true);
    assert.equal((await request({...b,sequence:7})).body.together,false);
    assert.ok(requests>0);assert.ok(store.has(redisKey('presence:v1')));
    // A fresh handler invocation still observes the persisted lock.
    assert.equal((await request({...a,visitorId:randomUUID(),sequence:1})).body.locked,true);
    globalThis.fetch=async()=>new Response(JSON.stringify({error:'denied'}),{status:401});
    await assert.rejects(redisCommand(['GET','x']),/Redis storage request failed/);
  }finally{
    Date.now=oldNow;globalThis.fetch=savedFetch;
    for(const [key,value] of Object.entries(savedEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
});
