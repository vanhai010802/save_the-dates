import { createMemoryFilm } from './memory-film.js';

function loadStyles() {
  for(const href of ['/assets/together-presence.css','/assets/memory-film.css']){
    if(document.querySelector(`link[href="${href}"]`))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
  }
}

let started = false;
export function startAnniversaryCake(getData) {
  if(started)return;
  started=true;
  const celebration=createTogetherCake(getData,{audioElement:document.getElementById('bg-music') || document.getElementById('background-music')});
  const hero=document.querySelector('#app .hero, .anniversary-hero') || document.body;
  const controls=document.createElement('div');controls.className='cake-actions';
  controls.innerHTML='<button type="button" class="together-replay">🎂 Xem lại bánh kem & kỷ niệm</button><button type="button" class="cake-reset">↻ Reset bánh kem</button><p class="cake-status" role="status"></p>';
  hero.append(controls);
  const status=controls.querySelector('.cake-status');
  controls.querySelector('.together-replay').addEventListener('click',()=>void celebration.open());

  const reset=document.createElement('dialog');reset.className='cake-reset-dialog';
  reset.innerHTML='<form><h2>Reset bánh kem</h2><p>Cho phép bánh kem tự mở một lần nữa, chung cho tất cả thiết bị.</p><label for="cake-reset-password">Mật khẩu reset</label><input id="cake-reset-password" type="password" autocomplete="current-password" required><p class="cake-reset-error" role="alert"></p><div><button type="button" class="cake-reset-cancel">Hủy</button><button type="submit">Xác nhận reset</button></div></form>';
  document.body.append(reset);
  const input=reset.querySelector('input'),error=reset.querySelector('.cake-reset-error'),submit=reset.querySelector('[type=submit]');
  function openReset(){error.textContent='';input.value='';reset.showModal();input.focus();}
  controls.querySelector('.cake-reset').addEventListener('click',openReset);
  reset.querySelector('.cake-reset-cancel').addEventListener('click',()=>reset.close());
  window.addEventListener('bk-reset',openReset);
  reset.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();submit.disabled=true;error.textContent='';
    try{
      const response=await fetch('/api/cake',{method:'POST',headers:{'content-type':'application/json','x-cake-password':input.value},body:JSON.stringify({action:'reset'}),signal:AbortSignal.timeout(10000)});
      const result=await response.json();
      if(!response.ok)throw Error(result.error || 'Chưa reset được bánh kem.');
      reset.close();
      status.textContent='Đã reset. Tải lại trang: chỉ máy vào đầu tiên sẽ tự mở bánh kem.';
    }catch(cause){error.textContent=cause.message;}
    finally{input.value='';submit.disabled=false;}
  });
  // Exactly one claim per page load; no heartbeat, polling, beacon or local-only
  // fallback that could accidentally show the cake on every device.
  void (async()=>{
    try{
      const response=await fetch('/api/cake',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'claim'}),signal:AbortSignal.timeout(10000)});
      const result=await response.json();
      if(!response.ok){status.textContent=result.error || 'Bạn có thể bấm Xem lại bánh kem.';return;}
      if(result.show)await celebration.open();
    }catch{status.textContent='Chưa kết nối được kho. Bạn vẫn có thể bấm Xem lại bánh kem.';}
  })();
}

export const startTogetherPresence=startAnniversaryCake;

export function createTogetherCake(getData, { test = false, audioElement } = {}) {
  loadStyles();
  let film;
  const modal=document.createElement('dialog');modal.className='together-celebration';
  const titleId=`together-title-${crypto.randomUUID()}`;modal.setAttribute('aria-labelledby',titleId);
  modal.innerHTML=`<button type="button" class="together-close" aria-label="Đóng bánh kem">×</button><span class="together-eyebrow">${test ? 'XEM LẠI KỶ NIỆM' : 'MỪNG NGÀY MÌNH CÓ NHAU'}</span><h2 id="${titleId}">Thêm một tháng, thêm yêu thương.</h2><p>Một chiếc bánh nhỏ, để cùng nhìn lại những khoảnh khắc của đôi ta.</p><div class="together-cake" aria-label="Bánh kem kỷ niệm"><span aria-hidden="true">🎂</span></div><button type="button" class="together-watch">Cùng xem lại kỷ niệm <span>▷</span></button><small>Chạm để mở thước phim của chúng mình</small>`;
  document.body.append(modal);
  if(!audioElement){audioElement=document.createElement('audio');audioElement.src='/assets/music.mp3';audioElement.loop=true;audioElement.preload='none';document.body.append(audioElement);}
  modal.querySelector('.together-close').addEventListener('click',()=>modal.close());
  modal.querySelector('.together-watch').addEventListener('click',()=>{if(!film)film=createMemoryFilm(getData,audioElement);if(film.open())modal.close();});
  return {dismiss(){modal.close();},close(){modal.close();film?.close();},async open(){
    if(modal.open)return;modal.showModal();
    try{
      const response=await fetch('/anniversary.html');if(!response.ok)return;
      const source=new DOMParser().parseFromString(await response.text(),'text/html');const cake=source.querySelector('svg.cake');
      if(cake){const candle=cake.querySelector('#candle-number');if(candle)candle.textContent=String(Math.max(1,Math.min(1200,Number(getData().config.anniversary_months)||6)));modal.querySelector('.together-cake').replaceChildren(document.importNode(cake,true));}
    }catch{}
  }};
}
