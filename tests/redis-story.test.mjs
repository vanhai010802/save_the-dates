import test from 'node:test';
import assert from 'node:assert/strict';
import { readData, writeData } from '../api/_lib.js';

test('after migration, loading and editing a story perform no Blob operations',async()=>{
  const previous={fetch:globalThis.fetch,url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN};
  const story={config:{person1_name:'Test'},milestones:[{id:'1',title:'Kept intact',media:[{url:'https://example.test/photo.jpg',type:'image'}]}],unlocked:true,unlocked_at:'2026-01-01'};
  let stored=JSON.stringify(story);const commands=[];
  try{
    process.env.UPSTASH_REDIS_REST_URL='https://redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='test-only-token';
    globalThis.fetch=async(url,options)=>{
      assert.equal(new URL(url).hostname,'redis.test','normal story traffic must never list or write Blob');
      const args=JSON.parse(options.body);commands.push(args[0]);
      let result;
      if(args[0]==='GET')result=stored;
      else if(args[0]==='SET'){stored=args[2];result='OK';}
      else throw Error('Unexpected command');
      return new Response(JSON.stringify({result}));
    };
    assert.deepEqual(await readData(),story);
    const changed={...story,config:{...story.config,anniversary_title:'Updated'}};
    await writeData(changed);
    assert.deepEqual(await readData(),changed);
    assert.deepEqual(commands,['GET','SET','GET']);
    assert.deepEqual(JSON.parse(stored).milestones,story.milestones,'migration does not rewrite media references');
  }finally{
    globalThis.fetch=previous.fetch;
    if(previous.url===undefined)delete process.env.UPSTASH_REDIS_REST_URL;else process.env.UPSTASH_REDIS_REST_URL=previous.url;
    if(previous.token===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;else process.env.UPSTASH_REDIS_REST_TOKEN=previous.token;
  }
});
