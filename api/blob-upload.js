import { handleUpload } from '@vercel/blob/client';
import {
  readJsonBody, sendJson, handleError, HttpError, verifyPassword,
} from './_lib.js';
import { createR2Upload, isMediaKey, isMediaType, MAX_MEDIA_BYTES, r2Storage } from './_r2.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed');
    }
    const body = await readJsonBody(req);

    if (body?.action === 'prepare') {
      verifyPassword(req);
      res.setHeader('Cache-Control', 'no-store');
      const r2 = r2Storage();
      if (!r2) return sendJson(res, 200, { provider: 'vercel' });
      const { pathname, contentType, size } = body;
      if (!isMediaKey(pathname)) throw new HttpError(400, 'Tên tệp không hợp lệ');
      if (!isMediaType(contentType)) throw new HttpError(400, 'Chỉ hỗ trợ ảnh và video');
      if (!Number.isSafeInteger(size) || size < 1) throw new HttpError(400, 'Tệp trống hoặc không hợp lệ');
      if (size > MAX_MEDIA_BYTES) throw new HttpError(413, 'Tệp vượt quá 100 MB');
      return sendJson(res, 200, { provider: 'r2', ...await createR2Upload(r2, pathname, contentType, size) });
    }

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload, _multipart) => {
        verifyPassword({ headers: { 'x-admin-password': clientPayload } });
        if (r2Storage()) throw new HttpError(409, 'Kho upload đã chuyển sang R2. Hãy tải lại trang.');
        if (!/^(avatars\/|milestones\/)/.test(pathname)) {
          throw new HttpError(400, 'Pathname không hợp lệ');
        }
        return {
          allowedContentTypes: ['image/*', 'video/*'],
          maximumSizeInBytes: MAX_MEDIA_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    sendJson(res, 200, jsonResponse);
  } catch (err) {
    handleError(res, err);
  }
}
