export function montageItems(value) {
  try {
    const items=typeof value==='string' ? JSON.parse(value) : value;
    if(!Array.isArray(items))return [];
    return items.map(item=>typeof item==='string'?{url:item,type:'image'}:item).filter(item=>{try{return typeof item?.url==='string' && /^https?:$/.test(new URL(item.url).protocol);}catch{return false;}}).slice(0,100).map(item=>({url:item.url,type:item.type==='video'?'video':'image',duration:Math.max(1000,Math.min(600000,Number(item.duration)||6000))}));
  } catch { return []; }
}

let bundledMedia;
export async function withMontageAssets(data) {
  if((data.recovery?.local || data.recovery?.unavailable) && !document.getElementById('local-recovery-notice')){
    const notice=document.createElement('p');notice.id='local-recovery-notice';notice.setAttribute('role','status');
    notice.textContent=data.recovery.unavailable ? 'Kho ảnh đang tạm khóa. Đang xem bản sao lưu thiếu; tải lại trang sau khi mở khóa để xem dữ liệu gốc.' : data.recovery.partial ? `Bản phục hồi thiếu từ 19/10: 13 mốc, ${data.recovery.recoveredMedia}/${data.recovery.expectedMedia} đường dẫn ảnh/video cũ. Web thật đang bị khóa kho dữ liệu.` : 'Đang xem bản sao lưu trên máy vì web thật chưa đọc được dữ liệu.';
    notice.style.cssText='position:fixed;top:0;left:0;right:0;z-index:5000;margin:0;padding:9px 16px;background:#fff0cb;color:#634819;font:12px/1.7 system-ui;text-align:center;';document.body.append(notice);
  }
  try {
    bundledMedia ??= fetch('/assets/montage/manifest.json').then(async response=>{
      if(!response.ok)throw Error('manifest');
      const items=await response.json();
      return items.map(item=>({...item,url:new URL(item.url,location.origin).href}));
    }).catch(error=>{bundledMedia=null;throw error;});
    const items=await bundledMedia;
    return {...data,config:{...data.config,anniversary_montage:JSON.stringify(items)}};
  } catch { return data; }
}
