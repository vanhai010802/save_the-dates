import { head, put, del, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob-state';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { HttpError } from './_lib.js';

export const CAKE_MARKER = 'celebration/cake-once-v2.json';

export function verifyCakePassword(value, expected = process.env.CAKE_RESET_PASSWORD) {
  if (!expected) throw new HttpError(503, 'Chưa cấu hình mật khẩu reset bánh kem.');
  const a=Buffer.from(String(value || '')), b=Buffer.from(expected);
  if (a.length!==b.length || !timingSafeEqual(a,b)) throw new HttpError(401, 'Mật khẩu reset bánh kem không đúng.');
}

export function createCakeStore({ headBlob=head, putBlob=put, deleteBlob=del }={}) {
  async function marker() {
    try { return await headBlob(CAKE_MARKER); }
    catch(error) { if(error instanceof BlobNotFoundError)return null;throw error; }
  }
  return {
    async claim() {
      if(await marker())return {show:false};
      try {
        // Atomic create: simultaneous devices cannot overwrite the first claim.
        await putBlob(CAKE_MARKER,JSON.stringify({claimedAt:new Date().toISOString(),id:randomUUID()}),{
          access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',cacheControlMaxAge:60,
        });
        return {show:true};
      }catch(error){
        if(error instanceof BlobPreconditionFailedError || /already exists/i.test(error.message))return {show:false};
        throw error;
      }
    },
    async reset() {
      const current=await marker();
      if(current)await deleteBlob(current.url,{ifMatch:current.etag});
      return {ok:true};
    },
  };
}
