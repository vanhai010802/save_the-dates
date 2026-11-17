import { readData, sendJson, handleError, HttpError } from './_lib.js';
import recoveryStory from '../assets/recovery-story.json' with { type: 'json' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      throw new HttpError(405, 'Method not allowed');
    }
    const data = await readData();
    sendJson(res, 200, data);
  } catch (err) {
    if(err.code==='BLOB_STORE_BLOCKED'){
      // Read-only fallback only: write endpoints still require original data.
      // No fallback JSON is ever written over the original Blob story.
      sendJson(res,200,{...recoveryStory,unlocked:true,recovery:{...recoveryStory.recovery,unavailable:true}});
      return;
    }
    handleError(res, err);
  }
}
