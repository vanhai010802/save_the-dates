export function montageItems(value) {
  try {
    const items=typeof value==='string' ? JSON.parse(value) : value;
    if(!Array.isArray(items))return [];
    return items.map(item=>typeof item==='string'?{url:item,type:'image'}:item).filter(item=>{try{return typeof item?.url==='string' && /^https?:$/.test(new URL(item.url).protocol);}catch{return false;}}).slice(0,100).map(item=>({url:item.url,type:item.type==='video'?'video':'image',duration:Math.max(1000,Math.min(600000,Number(item.duration)||6000))}));
  } catch { return []; }
}

let bundledMedia;
export async function withMontageAssets(data) {
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
