import { randomUUID } from 'node:crypto';
import {
  DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const KEY_PATTERN = /^(?:avatars|milestones\/[0-9]+)\/[a-z0-9][a-z0-9._-]{0,254}$/i;
const MEDIA_PATH = '/api/media?key=';

export const isMediaKey = key => typeof key === 'string' && KEY_PATTERN.test(key);
export const isMediaType = type => typeof type === 'string' && /^(?:image|video)\/[a-z0-9][a-z0-9.+-]*$/i.test(type);
export const r2MediaURL = key => MEDIA_PATH + encodeURIComponent(key);

export function isR2MediaURL(url) {
  if (!url.startsWith(MEDIA_PATH)) return false;
  try {
    const key = decodeURIComponent(url.slice(MEDIA_PATH.length));
    return isMediaKey(key) && r2MediaURL(key) === url;
  } catch {
    return false;
  }
}

let storage;
export function r2Storage() {
  const { R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (![R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY].some(Boolean)) return null;
  if (!/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID || '') || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 requires R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
  }
  storage ??= {
    bucket: R2_BUCKET,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
  return storage;
}

export async function createR2Upload({ client, bucket }, pathname, contentType, size) {
  const slash = pathname.lastIndexOf('/');
  const key = `${pathname.slice(0, slash + 1)}${randomUUID()}-${pathname.slice(slash + 1, slash + 218)}`;
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size,
  }), { expiresIn: 900, signableHeaders: new Set(['content-type', 'content-length']) });
  return { uploadUrl, url: r2MediaURL(key) };
}

export function getR2DownloadURL({ client, bucket }, key, method = 'GET') {
  const command = method === 'HEAD' ? HeadObjectCommand : GetObjectCommand;
  return getSignedUrl(client, new command({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
}

export async function deleteR2Prefix(prefix) {
  const r2 = r2Storage();
  if (!r2) return;
  const { client, bucket } = r2;
  let cursor;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: cursor,
    }));
    const objects = (page.Contents || []).map(({ Key }) => ({ Key }));
    if (objects.length) {
      const result = await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects } }));
      if (result.Errors?.length) throw new Error(`R2 could not delete ${result.Errors.length} object(s)`);
    }
    cursor = page.NextContinuationToken;
  } while (cursor);
}
