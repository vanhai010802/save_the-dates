import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/data.js';

test('blocked story is read-only fallback; unblocking automatically restores original data and URLs',async()=>{
  const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'];
  const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));const oldFetch=globalThis.fetch;
  const original={config:{person1_name:'Original'},milestones:[{id:'1',media:[{url:'https://original.test/full.jpg',type:'image'}]}],unlocked:true};
  let blocked=true,calls=0;
  const response=()=>({setHeader(){},status(code){this.statusCode=code;return this;},end(body){this.data=JSON.parse(body);}});
  try{
    keys.forEach(key=>delete process.env[key]);
    globalThis.fetch=async url=>{
      assert.ok(String(url).includes('.public.blob.vercel-storage.com/data-'),'reads must not call Blob list API');calls++;
      return blocked?new Response('Your store is blocked',{status:403}):new Response(JSON.stringify(original));
    };
    let res=response();await handler({method:'GET'},res);
    assert.equal(res.statusCode,200);assert.equal(res.data.recovery.unavailable,true);assert.equal(res.data.recovery.partial,true);
    blocked=false;res=response();await handler({method:'GET'},res);
    assert.equal(res.statusCode,200);assert.equal(res.data.recovery,undefined);
    assert.deepEqual(res.data.milestones,original.milestones);assert.equal(calls,2);
  }finally{
    globalThis.fetch=oldFetch;
    keys.forEach(key=>{if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];});
  }
});
