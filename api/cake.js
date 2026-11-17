import { createCakeStore, verifyCakePassword } from './_cake.js';
import { readJsonBody, sendJson, handleError, HttpError } from './_lib.js';
const store=createCakeStore();

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try{
    if(req.method!=='POST')throw new HttpError(405,'Method not allowed');
    const body=await readJsonBody(req);
    if(body.action==='reset'){
      verifyCakePassword(req.headers['x-cake-password']);
      return sendJson(res,200,await store.reset());
    }
    if(body.action!=='claim')throw new HttpError(400,'Thao tác không hợp lệ.');
    sendJson(res,200,await store.claim());
  }catch(error){
    if(error instanceof HttpError)return handleError(res,error);
    // Never pretend a local-only claim is a global claim while storage is down.
    sendJson(res,503,{code:'CAKE_STORAGE_UNAVAILABLE',error:'Kho đang tạm khóa. Bạn vẫn có thể bấm Xem lại bánh kem; lượt tự mở sẽ hoạt động khi kho mở lại.'});
  }
}
