import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { redisCommand, redisConfigured, redisKey } from '../api/_redis.js';

try { process.loadEnvFile?.('.env.local'); } catch {}
const args=process.argv.slice(2), source=args[args.indexOf('--source')+1];
if(!args.includes('--source') || !source){
  console.log('Usage: node scripts/migrate-story.mjs --source <backup.json-or-https-url>');
  process.exitCode=1;
}else{
  try{
    if(!redisConfigured())throw Error('Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local first.');
    let raw;
    if(/^https:\/\//.test(source)){
      const response=await fetch(source,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error(`Source returned HTTP ${response.status}; the source store must be unblocked first.`);
      raw=await response.text();
    }else raw=await readFile(source,'utf8');
    const data=JSON.parse(raw.replace(/^\uFEFF/,''));
    if(!data.config || typeof data.config!=='object' || Array.isArray(data.config) || !Array.isArray(data.milestones))throw Error('Source is not a valid story export; nothing was written.');
    delete data.preview;
    await mkdir('.preview',{recursive:true});
    const backup=`.preview/story-backup-${Date.now()}.json`;
    await writeFile(backup,JSON.stringify(data,null,2),{flag:'wx'});
    const saved=await redisCommand(['SET',redisKey('story:v1'),JSON.stringify(data),'NX']);
    if(saved===null)throw Error(`Redis already contains a story; it was not overwritten. Local backup: ${backup}`);
    console.log(`Migrated ${data.milestones.length} memories. Local backup: ${backup}. Original Blob data and media were preserved.`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
