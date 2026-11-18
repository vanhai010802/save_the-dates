import { buildFilmScenes, filmTimeline, FILM_FADE_MS } from './film-timeline.js';
import { filmMediaURL as safeURL, getFilmMedia, loadFilmMedia } from './film-media.js';
// A timed film made directly from the existing milestones and photo captions.
export function createMemoryFilm(getData, audioElement = document.getElementById('background-music')) {
  const dialog = document.createElement('dialog');
  dialog.className = 'memory-film';
  dialog.setAttribute('aria-label', 'Thước phim kỷ niệm của chúng mình');
  dialog.innerHTML = `<div class="film-grain" aria-hidden="true"></div>
    <header class="film-header"><span>♡ &nbsp; OUR LITTLE LOVE STORY</span><button type="button" class="film-close" aria-label="Đóng thước phim">×</button></header>
    <div class="film-stage"></div>
    <div class="film-announcement" role="status" aria-live="polite"></div>
    <footer class="film-controls"><div class="film-control-row"><div><button type="button" class="film-previous" aria-label="Cảnh trước">←</button><button type="button" class="film-play" aria-label="Tạm dừng thước phim">Ⅱ</button><button type="button" class="film-next" aria-label="Cảnh tiếp theo">→</button><span class="film-time"></span></div><div><button type="button" class="film-speed" aria-label="Tốc độ ảnh và chữ: 1×. Bấm để đổi sang 1.5×" title="Đổi tốc độ ảnh và chữ; video luôn phát 1×">1×</button><button type="button" class="film-sound" aria-label="Tắt nhạc thước phim" aria-pressed="true">♫ <span>Nhạc bật</span></button><span class="film-scene-count"></span></div></div><input class="film-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Tiến trình thước phim"><div class="film-bottom-note"><span>MỖI KHOẢNH KHẮC, MỘT CHÚT YÊU THƯƠNG</span><span>Space: phát / dừng · ← →: chuyển cảnh</span></div></footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const stage = $('.film-stage'), audio = audioElement;
  stage.style.setProperty('--film-fade-duration',`${FILM_FADE_MS}ms`);
  let scenes = [], index = 0, elapsed = 0, total = 0, offsets = [], playing = false, ended = false;
  let frame = 0, lastTime = 0, sound = true, audioWasPlaying = false, token = 0, revealTimer;
  const speeds = [1, 1.5, 2];
  let speed = 1;
  let videoLoadFailed = false;
  const make = (tag, className, text) => { const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=String(text).normalize('NFC');return el; };
  const clock = ms => `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
  function buildScenes() {
    scenes = buildFilmScenes(getData(), safeURL);
    ({offsets, total} = filmTimeline(scenes));
  }
  function playAudio() { if(sound && playing)audio.play().catch(()=>{sound=false;updateSound();}); }
  function updateSound(){ $('.film-sound').setAttribute('aria-pressed',String(sound));$('.film-sound').setAttribute('aria-label',sound?'Tắt nhạc thước phim':'Bật nhạc thước phim');$('.film-sound span').textContent=sound?'Nhạc bật':'Nhạc tắt'; }
  function setPlaying(value) {
    playing=value;dialog.classList.toggle('film-paused',!playing);$('.film-play').textContent=ended?'↻':playing?'Ⅱ':'▷';$('.film-play').setAttribute('aria-label',ended?'Xem lại thước phim':playing?'Tạm dừng thước phim':'Phát thước phim');
    stage.querySelectorAll('.film-scene:not(.film-leaving) video').forEach(video=>playing ? video.play().catch(()=>{}) : video.pause());
    if(playing)playAudio();else audio.pause();lastTime=performance.now();
  }
  function updateProgress(){
    const position=offsets[index]+elapsed;
    $('.film-time').textContent=`${clock(position)} / ${clock(total)}`;
    $('.film-seek').value=String(Math.round(position/total*1000));
    $('.film-seek').style.setProperty('--film-progress',`${position/total*100}%`);
    $('.film-scene-count').textContent=`${String(index+1).padStart(2,'0')} / ${scenes.length}`;
    $('.film-previous').disabled=index===0;$('.film-next').disabled=index===scenes.length-1;
  }
  function showScene(next,progress=0){
    token++;const currentToken=token;clearTimeout(revealTimer);
    index=Math.max(0,Math.min(scenes.length-1,next));elapsed=progress;ended=false;videoLoadFailed=false;
    const scene=scenes[index], card=make('section',`film-scene film-${scene.type} film-variant-${(scene.chapter ?? index)%3}`);
    if(scene.chapter!==undefined)card.dataset.chapter=String(scene.chapter);
    let mounted=false;
    const mount=()=>{
      if(mounted || currentToken!==token)return;mounted=true;
      const old=stage.lastElementChild;
      if(old){
        old.querySelectorAll('video').forEach(v=>v.pause());
        old.classList.add('film-leaving');old.setAttribute('aria-hidden','true');old.inert=true;
      }
      if(!playing)card.classList.add('film-static-enter');
      const reveal=()=>{
        if(currentToken!==token || !dialog.open)return;
        // Replace only after the outgoing fade. There is never a second image
        // underneath a transparent incoming frame, even during rapid seeking.
        stage.replaceChildren(card);
        const video=card.querySelector('video');
        if(video){video.playbackRate=1;video.currentTime=Math.min(elapsed/1000,Math.max(0,video.duration-.1));if(playing)video.play().catch(()=>{});}
      };
      const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(old && playing && !reducedMotion)revealTimer=setTimeout(reveal,FILM_FADE_MS);
      else reveal();
    };
    card.setAttribute('aria-label',scene.title);card.style.setProperty('--scene-duration',`${scene.duration}ms`);if(!playing)card.classList.add('film-static-enter');
    const copy=make('div','film-copy');copy.append(make('span','film-kicker',scene.kicker),make('h2','film-title',scene.title),make('p','film-description',scene.description));
    if(scene.type==='photo' || scene.type==='montage'){
      const photo=make('div','film-photo-frame'), background=make('div','film-photo-wash');
      card.classList.add('film-awaiting');card.append(background,photo);
      const attach=media=>{
        if(!media || currentToken!==token || !dialog.open)return;
        media.hidden=false;
        if(media.tagName==='VIDEO'){
          media.playbackRate=1;
          if(Number.isFinite(media.duration) && media.duration>0){
            // Uploaded clips may not include duration metadata in story JSON.
            scene.duration=Math.max(1000,media.duration*1000);
            ({offsets,total}=filmTimeline(scenes));
            elapsed=Math.min(elapsed,scene.duration);updateProgress();
          }
          media.currentTime=Math.min(elapsed/1000,Math.max(0,media.duration-.1));
          if(playing && card.isConnected)media.play().catch(()=>{});else media.pause();
        }else{
          media.alt=scene.media.caption || scene.title;
          background.style.backgroundImage=`url(${JSON.stringify(media.currentSrc || media.src)})`;
        }
        photo.append(media);
        if(scene.type==='photo')photo.append(make('span','film-photo-number',`MEMORY ${String(scene.chapter+1).padStart(2,'0')} / FRAME ${String(scene.photo+1).padStart(2,'0')}`));
        copy.hidden=scene.type==='montage';
        card.classList.remove('film-awaiting');card.classList.add('film-media-ready');
      };
      const url=safeURL(scene.media.url), cached=getFilmMedia(url);
      if(cached)attach(cached);
      else void loadFilmMedia(url,scene.media.type).then(ok=>{
        if(ok)attach(getFilmMedia(url));
        else if(currentToken===token && scene.media.type==='video')videoLoadFailed=true;
      });
    }else{
      const ornament=make('div','film-ornament');ornament.setAttribute('aria-hidden','true');
      ornament.innerHTML='<svg viewBox="0 0 160 100"><path class="film-heart-path" d="M10 60h33l9-14 11 30 11-53 12 37h15c-25-18-14-42 2-28 17-15 32 8 2 28h44"/></svg>';
      card.append(ornament);
      if(scene.type==='intro')card.append(make('div','film-wish-sparks','✧　 ♡　 ✧'));
      if(scene.type==='outro'){
        copy.append(make('span','film-signature',scene.names));
        const replay=make('button','film-replay','↻  Xem lại từ đầu');replay.type='button';replay.addEventListener('click',()=>{setPlaying(true);showScene(0);});copy.append(replay);
      }
    }
    card.append(copy);
    // Text is available immediately; late media joins only its own current scene.
    mount();
    prefetchUpcoming();
    $('.film-announcement').textContent=`${index+1} / ${scenes.length}: ${scene.title}`;
    $('.film-play').textContent=playing?'Ⅱ':'▷';$('.film-play').setAttribute('aria-label',playing?'Tạm dừng thước phim':'Phát thước phim');
    lastTime=performance.now();updateProgress();
  }
  function prefetchUpcoming(){
    const upcoming=scenes.slice(index+1).filter(scene=>scene.media).slice(0,6);
    for(const scene of upcoming)void loadFilmMedia(safeURL(scene.media.url),scene.media.type,'auto');
  }
  function tick(now){
    if(!dialog.open)return;
    if(playing){
      const isVideo=scenes[index].media?.type==='video';
      if(isVideo && !videoLoadFailed){
        // Follow the clip's actual clock, including loading and buffering.
        // The photo speed must never skip or shorten an attached video.
        const video=stage.querySelector('.film-scene:not(.film-leaving) video');
        if(video){
          elapsed=Math.min(scenes[index].duration,video.currentTime*1000);
          if(video.ended)showScene(index+1);
        }
      }else{
        const position=Math.min(total,offsets[index]+elapsed+Math.max(0,now-lastTime)*(isVideo?1:speed));
        const next=offsets.findLastIndex(start=>start<=position);
        if(next!==index)showScene(next,scenes[next].media?.type==='video'?0:position-offsets[next]);else elapsed=position-offsets[index];
        if(position>=total){
          elapsed=total-offsets[index];ended=true;setPlaying(false);
        }
      }
      updateProgress();
    }
    lastTime=now;frame=requestAnimationFrame(tick);
  }
  function toggle(){if($('.film-play').disabled)return;if(ended){setPlaying(true);showScene(0);}else setPlaying(!playing);}
  $('.film-play').addEventListener('click',toggle);
  $('.film-close').addEventListener('click',()=>dialog.close());
  $('.film-previous').addEventListener('click',()=>showScene(index-1));$('.film-next').addEventListener('click',()=>showScene(index+1));
  $('.film-sound').addEventListener('click',()=>{sound=!sound;updateSound();if(sound)playAudio();else audio.pause();});
  $('.film-speed').addEventListener('click',()=>{
    speed=speeds[(speeds.indexOf(speed)+1)%speeds.length];
    $('.film-speed').textContent=`${speed}×`;
    $('.film-speed').setAttribute('aria-label',`Tốc độ ảnh và chữ: ${speed}×. Bấm để đổi sang ${speeds[(speeds.indexOf(speed)+1)%speeds.length]}×`);
    lastTime=performance.now();
  });
  $('.film-seek').addEventListener('input',e=>{const target=Number(e.target.value)/1000*total;const next=offsets.findLastIndex(start=>start<=target);showScene(next,Math.min(target-offsets[next],scenes[next].duration));});
  dialog.addEventListener('keydown',e=>{if($('.film-play').disabled && e.key!=='Escape')return;if(e.target.matches('input,button') && (e.code==='Space' || e.key==='Enter'))return;if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft' && e.target.tagName!=='INPUT'){e.preventDefault();showScene(index-1);}else if(e.key==='ArrowRight' && e.target.tagName!=='INPUT'){e.preventDefault();showScene(index+1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden && dialog.open)setPlaying(false);});
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);clearTimeout(revealTimer);token++;setPlaying(false);stage.replaceChildren();if(audioWasPlaying)audio.play().catch(()=>{});});
  return {close(){dialog.close();},open(){
    if(dialog.open)return false;
    ended=false;
    $('.film-play').disabled=false;$('.film-seek').disabled=false;
    buildScenes();audioWasPlaying=!audio.paused;sound=true;updateSound();dialog.showModal();
    stage.replaceChildren();
    setPlaying(!document.hidden);showScene(0);frame=requestAnimationFrame(tick);$('.film-play').focus();
    return true;
  }};
}
