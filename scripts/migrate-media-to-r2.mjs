import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { COMPARE_AND_SET, redisCommand, redisConfigured, redisKey } from '../api/_redis.js';
import { isMediaType, MAX_MEDIA_BYTES, r2MediaURL, r2Storage } from '../api/_r2.js';

const STORY_URL = 'https://savethedates.vercel.app/api/data';
const BLOB_HOST = /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/;

function planMigration(story) {
  if (!story?.config || !Array.isArray(story.milestones) || story.recovery?.unavailable) {
    throw new Error('Không có dữ liệu album gốc để chuyển.');
  }

  const files = new Map();
  function queue(source, prefix) {
    if (typeof source !== 'string' || !/^https:\/\//i.test(source) || !URL.canParse(source)) return source;
    const url = new URL(source);
    if (!BLOB_HOST.test(url.hostname) || url.port || url.username || url.password) return source;
    if (!url.pathname.startsWith('/avatars/') && !url.pathname.startsWith('/milestones/')) return source;
    url.hash = '';
    const extension = url.pathname.match(/\.[a-z0-9]{1,10}$/i)?.[0] || '';
    const hash = createHash('sha256').update(url.href).digest('hex');
    const key = `${prefix}/import-${hash}${extension}`;
    files.set(key, url.href);
    return r2MediaURL(key);
  }

  const config = { ...story.config };
  for (const field of ['person1_avatar_url', 'person2_avatar_url']) {
    if (field in config) config[field] = queue(config[field], 'avatars');
  }
  const milestones = story.milestones.map(milestone => {
    if (!/^[0-9]+$/.test(milestone.id) || !Array.isArray(milestone.media)) return milestone;
    return {
      ...milestone,
      media: milestone.media.map(media => ({ ...media, url: queue(media.url, `milestones/${milestone.id}`) })),
    };
  });
  return { files, updatedStory: { ...story, config, milestones } };
}

async function copyFile({ client, bucket }, key, source) {
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Vercel Blob trả HTTP ${response.status}.`);
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim();
  const size = Number(response.headers.get('content-length'));
  if (!isMediaType(contentType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_MEDIA_BYTES) {
    throw new Error('Tệp nguồn có định dạng hoặc kích thước không hợp lệ.');
  }
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length !== size) throw new Error('Tệp tải về bị thiếu dữ liệu.');
  const object = { Bucket: bucket, Key: key };
  await client.send(new PutObjectCommand({ ...object, Body: body, ContentLength: size, ContentType: contentType }));
  const stored = await client.send(new HeadObjectCommand(object));
  if (stored.ContentLength !== size || stored.ContentType !== contentType) throw new Error('Xác minh bản sao R2 thất bại.');
}

async function readLiveStory() {
  const response = await fetch(STORY_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`API album trả HTTP ${response.status}.`);
  return response.text();
}

async function main() {
  try { process.loadEnvFile('.env.local'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }

  const args = process.argv.slice(2);
  const apply = args[0] === '--apply';
  if (args.length > 1 || (args.length && !apply && args[0] !== '--dry-run')) {
    throw new Error('Dùng node scripts/migrate-media-to-r2.mjs [--dry-run | --apply]');
  }
  const r2 = apply ? r2Storage() : null;
  if (apply && !r2) throw new Error('Cần cấu hình R2 trong .env.local trước khi chuyển.');

  const useRedis = redisConfigured();
  const key = redisKey('story:v1');
  let blobStore;
  let raw;
  if (useRedis) {
    raw = await redisCommand(['GET', key]);
    if (raw === null) throw new Error('Redis chưa có dữ liệu album. Hãy chuyển dữ liệu album sang Redis trước.');
  } else if (apply) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Cần BLOB_READ_WRITE_TOKEN để cập nhật dữ liệu album trên Vercel.');
    blobStore = await import('../api/_lib.js');
    const [story, live] = await Promise.all([blobStore.readData(), readLiveStory()]);
    if (!isDeepStrictEqual(story, JSON.parse(live))) throw new Error('Dữ liệu của Blob khác với album đang chạy. Hãy kiểm tra cấu hình kho dữ liệu.');
    raw = JSON.stringify(story);
  } else {
    raw = await readLiveStory();
  }

  const story = JSON.parse(raw);
  const { files, updatedStory } = planMigration(story);
  console.log(`Tìm thấy ${files.size} tệp Vercel Blob cần chuyển.`);
  if (!apply || !files.size) return;

  await mkdir('.preview', { recursive: true });
  const backup = `.preview/story-before-r2-${Date.now()}.json`;
  await writeFile(backup, raw, { flag: 'wx' });
  console.log(`Đã sao lưu dữ liệu album tại ${backup}`);
  let copied = 0;
  for (const [objectKey, source] of files) {
    try { await copyFile(r2, objectKey, source); }
    catch (error) { throw new Error(`Tệp ${copied + 1}/${files.size}: ${error.message}`); }
    console.log(`Đã sao chép và kiểm tra ${++copied}/${files.size} tệp.`);
  }

  const conflict = 'Album vừa thay đổi. Chạy lại lệnh để chuyển dựa trên bản mới nhất.';
  if (useRedis) {
    const saved = await redisCommand(['EVAL', COMPARE_AND_SET, 1, key, raw, JSON.stringify(updatedStory)]);
    if (saved !== 1) throw new Error(conflict);
  } else {
    if (!isDeepStrictEqual(await blobStore.readData(), story)) throw new Error(conflict);
    await blobStore.writeData(updatedStory);
  }
  console.log('Đã cập nhật album sang R2. Ảnh và video gốc vẫn ở Vercel Blob.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
