import { createMemoryFilm } from './memory-film.js';

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
  modal.querySelector('.together-watch').addEventListener('click',()=>{modal.close();if(!film)film=createMemoryFilm(getData,audioElement);film.open();});
  return {async open(){
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
  // A page instance is a participant, including duplicated tabs. Browser-wide
  // storage would merge both tabs, and a copied session ID has the same issue.
  const visitorId=crypto.randomUUID();
  let pending=false, shownCycle=null, stopped=false, interval;
  const status=document.createElement('p');status.className='together-presence-status';status.setAttribute('role','status');status.textContent='♡ Đang chờ người thương cùng ghé thăm…';hero.append(status);
  const celebration=createTogetherCake(getData,{audioElement:document.getElementById('bg-music') || document.getElementById('background-music')});
  const eligible=()=>!stopped;
  async function showCake(cycle){
    if(shownCycle===cycle || !eligible())return;shownCycle=cycle;status.textContent='♡ Hai đứa đều đang ở đây';
    await celebration.open();
  }
  async function pulse(){
    if(!eligible() || pending)return;pending=true;
    try{
      const response=await fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitorId,active:true}),cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('presence');const data=await response.json();
      if(eligible()){status.textContent=data.fired?'♡ Bánh kem đã mở · Reset BK trong panel để mở lại':data.count>=2?'♡ Hai đứa đều đang ở đây':'♡ Bạn đã ở đây · Chờ người thương thêm một chút nhé';if(data.together)await showCake(data.cycle);}
    }catch{if(eligible())status.textContent='♡ Chưa kết nối được trạng thái online · Đang thử lại…';}finally{pending=false;}
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)pulse();});
  interval=setInterval(pulse,8000);
  pulse();
  window.addEventListener('pagehide',()=>{stopped=true;clearInterval(interval);navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({visitorId,active:false})],{type:'application/json'}));});
  window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;interval=setInterval(pulse,8000);pulse();}});
  window.addEventListener('bk-reset',pulse);
}
