import { createMemoryFilm } from './memory-film.js';
import { updateFilmPlayback, stopFilmPlayback, filmPlaybackState } from './film-playback.js';

function loadStyles() {
  for(const href of ['/assets/together-presence.css','/assets/memory-film.css']){
    if(document.querySelector(`link[href="${href}"]`))continue;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);
  }
}

export function createTogetherCake(getData, { test = false, audioElement } = {}) {
  loadStyles();
  let film;
  const modal=document.createElement('dialog');modal.className='together-celebration';
  const titleId=`together-title-${crypto.randomUUID()}`;modal.setAttribute('aria-labelledby',titleId);
  modal.innerHTML=`<button type="button" class="together-close" aria-label="Đóng bánh kem">×</button><span class="together-eyebrow">${test ? 'XEM THỬ · KHÔNG CẦN HAI THIẾT BỊ' : 'HAI ĐỨA ĐỀU ĐANG Ở ĐÂY'}</span><h2 id="${titleId}">Đủ hai đứa, đủ yêu thương.</h2><p>Một chiếc bánh nhỏ, dành cho khoảnh khắc mình cùng online.</p><div class="together-cake" aria-label="Bánh kem kỷ niệm"><span aria-hidden="true">🎂</span></div><button type="button" class="together-watch">Cùng xem lại kỷ niệm <span>▷</span></button><small>Chạm để mở thước phim của chúng mình</small>`;
  document.body.append(modal);
  if(!audioElement){audioElement=document.createElement('audio');audioElement.src='/assets/music.mp3';audioElement.loop=true;audioElement.preload='none';document.body.append(audioElement);}
  modal.querySelector('.together-close').addEventListener('click',()=>modal.close());
  modal.querySelector('.together-watch').addEventListener('click',()=>{if(!film)film=createMemoryFilm(getData,audioElement,{test});if(film.open())modal.close();});
  return {dismiss(){modal.close();},close(){modal.close();film?.close();},async open(){
    if(modal.open)return;modal.showModal();
    try{
      const response=await fetch('/anniversary.html');if(!response.ok)return;
      const source=new DOMParser().parseFromString(await response.text(),'text/html');const cake=source.querySelector('svg.cake');
      if(cake){const candle=cake.querySelector('#candle-number');if(candle)candle.textContent=String(Math.max(1,Math.min(1200,Number(getData().config.anniversary_months)||6)));modal.querySelector('.together-cake').replaceChildren(document.importNode(cake,true));}
    }catch{}
  }};
}

let started = false;
export function startTogetherPresence(getData) {
  if (started) return; started = true;
  const hero = document.querySelector('#app .hero, .anniversary-hero');
  loadStyles();
  const visitorId=crypto.randomUUID();
  let userId;
  try { userId=localStorage.getItem('together-user-id');if(!/^[a-f0-9-]{36}$/i.test(userId || '')){userId=crypto.randomUUID();localStorage.setItem('together-user-id',userId);} }
  catch { userId=crypto.randomUUID(); }
  let pending=false, shownCycle=null, stopped=false, generation=0, sequence=0, controller, completedCycle=null, interval;
  const status=document.createElement('p');status.className='together-presence-status';status.setAttribute('role','status');hero.append(status);
  const celebration=createTogetherCake(getData,{audioElement:document.getElementById('bg-music') || document.getElementById('background-music')});
  const eligible=()=>!stopped && !document.hidden;
  const payload=active=>JSON.stringify({visitorId,userId,active,sequence:++sequence,...(active && completedCycle?{action:'complete',resetCycle:completedCycle}:{})});
  function closeCake(){celebration.close();shownCycle=null;}
  function leave(){
    generation++;controller?.abort();pending=false;stopFilmPlayback();closeCake();
    status.textContent='♡ Đang chờ người thương cùng ghé thăm…';
    const body=payload(false);
    if(!navigator.sendBeacon('/api/presence',new Blob([body],{type:'application/json'})))fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
  }
  async function pulse(){
    if(!eligible() || pending)return;
    pending=true;const current=++generation;const requestController=new AbortController();controller=requestController;
    const timeout=setTimeout(()=>requestController.abort(),3500);
    try{
      const response=await fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:payload(true),cache:'no-store',signal:controller.signal});
      if(current!==generation || !eligible())return;
      if(!response.ok){
        const error=await response.json().catch(()=>({}));
        if(error.code==='PRESENCE_NOT_CONFIGURED'){
          stopped=true;clearInterval(interval);stopFilmPlayback();closeCake();
          status.textContent='♡ Tính năng xem chung đang được bảo trì.';return;
        }
        throw Error('presence');
      }
      const data=await response.json();
      if(current!==generation || !eligible())return;
      if(data.locked || (completedCycle && data.resetCycle!==completedCycle))completedCycle=null;
      updateFilmPlayback(data);
      const locked=filmPlaybackState().locked;
      status.textContent=locked?'♡ Phim đã phát xong · Reset BK để mở lượt xem mới':data.together?'♡ Hai đứa đều đang ở đây':data.count>=2?'♡ Đủ hai đứa · Giữ kết nối 5 giây nhé':'♡ Bạn đã ở đây · Chờ người thương thêm một chút nhé';
      if(data.together && !locked){if(shownCycle!==data.cycle){shownCycle=data.cycle;void celebration.open();}}
      else if(locked && data.count>=2)celebration.dismiss();
      else {stopFilmPlayback();closeCake();}
    }catch{
      if(current===generation && eligible()){closeCake();status.textContent='♡ Chưa kết nối được trạng thái online · Đang thử lại…';leave();}
    }finally{clearTimeout(timeout);if(current===generation)pending=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)leave();else pulse();});
  interval=setInterval(pulse,1000);
  pulse();
  window.addEventListener('pagehide',()=>{stopped=true;leave();});
  window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;pulse();}});
  window.addEventListener('bk-reset',()=>{stopFilmPlayback();closeCake();pulse();});
  window.addEventListener('film-complete',event=>{completedCycle=event.detail.cycle;celebration.dismiss();pulse();});
}
