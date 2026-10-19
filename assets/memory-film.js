import { montageItems } from './montage-data.js';
import { filmMediaURL as safeURL, getFilmMedia, loadFilmMedia } from './film-media.js';
import { canPlayFilm, filmPlaybackState, completeFilmPlayback } from './film-playback.js';
const FILM_DURATION = 180000;
// A timed film made directly from the existing milestones and photo captions.
export function createMemoryFilm(getData, audioElement = document.getElementById('background-music'), { test=false } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'memory-film';
  dialog.setAttribute('aria-label', 'Thước phim kỷ niệm của chúng mình');
  dialog.innerHTML = `<div class="film-grain" aria-hidden="true"></div>
    <header class="film-header"><span>♡ &nbsp; OUR LITTLE LOVE STORY</span><button type="button" class="film-close" aria-label="Đóng thước phim">×</button></header>
    <div class="film-stage"></div>
    <div class="film-announcement" role="status" aria-live="polite"></div>
    <footer class="film-controls"><div class="film-control-row"><div><button type="button" class="film-previous" aria-label="Cảnh trước">←</button><button type="button" class="film-play" aria-label="Tạm dừng thước phim">Ⅱ</button><button type="button" class="film-next" aria-label="Cảnh tiếp theo">→</button><span class="film-time"></span></div><div><button type="button" class="film-sound" aria-label="Tắt nhạc thước phim" aria-pressed="true">♫ <span>Nhạc bật</span></button><span class="film-scene-count"></span></div></div><input class="film-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Tiến trình thước phim"><div class="film-bottom-note"><span>MỖI KHOẢNH KHẮC, MỘT CHÚT YÊU THƯƠNG</span><span>Space: phát / dừng · ← →: chuyển cảnh</span></div></footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const stage = $('.film-stage'), audio = audioElement;
  let scenes = [], index = 0, elapsed = 0, total = 0, offsets = [], playing = false, ended = false;
  let frame = 0, lastTime = 0, sound = true, audioWasPlaying = false, token = 0, revealTimer, completed=false, playbackCycle;
  const make = (tag, className, text) => { const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=String(text).normalize('NFC');return el; };
  const formatDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('.') : '';
  const clock = ms => `${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
  function buildScenes() {
    const { config = {}, milestones = [] } = getData();
    const months = Math.max(1,Math.min(1200,Number(config.anniversary_months)||6));
    scenes = [{type:'intro',duration:3400,kicker:'MỘT CHIẾC BÁNH. MỘT ĐIỀU ƯỚC.',title:`${months} tháng có nhau.`,description:config.anniversary_title || 'Nếu được chọn lại từ đầu, anh vẫn sẽ chọn gặp em.'}];
    [...milestones].sort((a,b)=>(a.date || '').localeCompare(b.date || '')).forEach((memory,chapter)=>{
      scenes.push({type:'chapter',duration:2500,kicker:`CHƯƠNG ${String(chapter+1).padStart(2,'0')} · ${formatDate(memory.date)}`,title:memory.title || 'Một ngày có nhau',description:memory.description || 'Có những ngày, chỉ cần ở cạnh nhau là đủ.',emoji:memory.emoji || '♡'});
      const items=(memory.media || []).filter(m=>safeURL(m.url));
      const photoDuration=items.filter(media=>media.type!=='video').length>=4 ? 1000 : 2000;
      items.forEach((media,photo)=>scenes.push({type:'photo',duration:media.type==='video' ? 2000 : photoDuration,media,kicker:formatDate(memory.date),title:memory.title || 'Một ngày có nhau',description:media.caption || memory.description || 'Một khoảnh khắc nhỏ. Một kỷ niệm thật lâu.',photo,chapter}));
    });
    scenes.push({type:'outro',duration:6800,kicker:'VÀ CÂU CHUYỆN VẪN ĐANG TIẾP TỤC…',title:'Mình còn cả mai sau.',description:config.anniversary_message || 'Cảm ơn em vì những ngày đã qua.\nMình cứ nắm tay nhau, viết tiếp những tháng năm thật đẹp nhé.',names:`${config.person1_name || 'Hải'} & ${config.person2_name || 'Yên'}`});
    const finale=scenes.pop();
    scenes.push({type:'chapter',duration:2500,kicker:'OUR MOMENTS',title:'Những khoảnh khắc của đôi ta',description:''});
    montageItems(config.anniversary_montage).forEach((media,photo)=>scenes.push({type:'montage',duration:media.type==='video'?media.duration:1500,media,title:`Những khoảnh khắc của đôi ta — ${media.type==='video'?'video':'ảnh'} ${photo+1}`,photo}));
    scenes.push(finale);
    fitTimeline();
  }
  function fitTimeline() {
    // Preserve video clip lengths where possible; fit the remaining scenes into
    // exactly three minutes regardless of the number of memories.
    const videoTime=scenes.reduce((sum,scene)=>sum+(scene.media?.type==='video'?scene.duration:0),0);
    const fixed=videoTime<FILM_DURATION-20000?videoTime:0;
    const flexible=scenes.reduce((sum,scene)=>sum+(fixed && scene.media?.type==='video'?0:scene.duration),0);
    scenes.forEach(scene=>{if(!(fixed && scene.media?.type==='video'))scene.duration=scene.duration/flexible*(FILM_DURATION-fixed);});
    scenes.at(-1).duration+=FILM_DURATION-scenes.reduce((sum,scene)=>sum+scene.duration,0);
    let offset=0;offsets=scenes.map(scene=>{const start=offset;offset+=scene.duration;return start;});total=FILM_DURATION;
  }
  function playAudio() { if(sound && playing)audio.play().catch(()=>{sound=false;updateSound();}); }
  function updateSound(){ $('.film-sound').setAttribute('aria-pressed',String(sound));$('.film-sound').setAttribute('aria-label',sound?'Tắt nhạc thước phim':'Bật nhạc thước phim');$('.film-sound span').textContent=sound?'Nhạc bật':'Nhạc tắt'; }
  function setPlaying(value) {
    if(value && completed && !test)return;
    playing=value;dialog.classList.toggle('film-paused',!playing);$('.film-play').textContent=completed&&!test?'✓':ended?'↻':playing?'Ⅱ':'▷';$('.film-play').setAttribute('aria-label',completed&&!test?'Phim đã phát xong':ended?'Xem lại thước phim':playing?'Tạm dừng thước phim':'Phát thước phim');
    stage.querySelectorAll('.film-scene:not(.film-leaving) video').forEach(video=>playing ? video.play().catch(()=>{}) : video.pause());
    if(playing)playAudio();else audio.pause();lastTime=performance.now();
  }
  function updateProgress(){
    const position=offsets[index]+elapsed;
    $('.film-time').textContent=`${clock(position)} / ${clock(total)}`;
    $('.film-seek').value=String(Math.round(position/total*1000));
    $('.film-seek').style.setProperty('--film-progress',`${position/total*100}%`);
    $('.film-scene-count').textContent=`${String(index+1).padStart(2,'0')} / ${scenes.length}`;
    $('.film-previous').disabled=completed&&!test || index===0;$('.film-next').disabled=completed&&!test || index===scenes.length-1;
  }
  function showScene(next,progress=0){
    if(completed && !test)return;
    token++;const currentToken=token;clearTimeout(revealTimer);
    index=Math.max(0,Math.min(scenes.length-1,next));elapsed=progress;ended=false;
    const scene=scenes[index], card=make('section',`film-scene film-${scene.type} film-variant-${(scene.chapter ?? index)%3}`);
    if(scene.chapter!==undefined)card.dataset.chapter=String(scene.chapter);
    let mounted=false;
    const mount=()=>{
      if(mounted || currentToken!==token)return;mounted=true;
      stage.querySelectorAll('.film-leaving').forEach(el=>el.remove());
      const old=stage.lastElementChild;
      const dissolvePhotos=old?.classList.contains('film-photo') && scene.type==='photo' && old.dataset.chapter===String(scene.chapter);
      if(old){
        old.querySelectorAll('video').forEach(v=>v.pause());
        if(dissolvePhotos){
          // Retain only the outgoing image, never an earlier chapter's words.
          old.querySelectorAll('.film-copy,.film-ornament,.film-wish-sparks').forEach(el=>el.remove());
          old.classList.add('film-leaving');old.setAttribute('aria-hidden','true');old.inert=true;
        }else old.remove();
      }
      if(!playing)card.classList.add('film-static-enter');
      const reveal=()=>{
        if(currentToken!==token || !dialog.open)return;
        stage.append(card);
      };
      // At chapter boundaries, clear the old scene first and leave a short
      // empty beat before showing the new text. Never overlap the two layouts.
      if(old && !dissolvePhotos)revealTimer=setTimeout(reveal,120);
      else reveal();
      if(dissolvePhotos)setTimeout(()=>old.remove(),700);
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
          media.currentTime=Math.min(elapsed/1000,Math.max(0,media.duration-.1));
          if(playing)media.play().catch(()=>{});else media.pause();
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
      else void loadFilmMedia(url,scene.media.type).then(ok=>{if(ok)attach(getFilmMedia(url));});
    }else{
      const ornament=make('div','film-ornament');ornament.setAttribute('aria-hidden','true');
      ornament.innerHTML='<svg viewBox="0 0 160 100"><path class="film-heart-path" d="M10 60h33l9-14 11 30 11-53 12 37h15c-25-18-14-42 2-28 17-15 32 8 2 28h44"/></svg>';
      card.append(ornament);
      if(scene.type==='intro')card.append(make('div','film-wish-sparks','✧　 ♡　 ✧'));
      if(scene.type==='outro'){
        copy.append(make('span','film-signature',scene.names));
        if(test){const replay=make('button','film-replay','↻  Xem lại từ đầu');replay.type='button';replay.addEventListener('click',()=>{setPlaying(true);showScene(0);});copy.append(replay);}
        else copy.append(make('p','film-complete-note','Phim chỉ phát một lần. Bấm Reset BK để mở lượt xem mới.'));
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
      const position=Math.min(total,offsets[index]+elapsed+Math.max(0,now-lastTime));
      const next=offsets.findLastIndex(start=>start<=position);
      if(next!==index)showScene(next,position-offsets[next]);else elapsed=position-offsets[index];
      if(position>=total){
        elapsed=total-offsets[index];ended=true;completed=true;setPlaying(false);
        if(!test){$('.film-play').disabled=true;$('.film-seek').disabled=true;completeFilmPlayback(playbackCycle);}
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
  $('.film-seek').addEventListener('input',e=>{const target=Number(e.target.value)/1000*total;const next=offsets.findLastIndex(start=>start<=target);showScene(next,Math.min(target-offsets[next],scenes[next].duration));});
  dialog.addEventListener('keydown',e=>{if($('.film-play').disabled && e.key!=='Escape')return;if(e.target.matches('input,button') && (e.code==='Space' || e.key==='Enter'))return;if(e.code==='Space'){e.preventDefault();toggle();}else if(e.key==='ArrowLeft' && e.target.tagName!=='INPUT'){e.preventDefault();showScene(index-1);}else if(e.key==='ArrowRight' && e.target.tagName!=='INPUT'){e.preventDefault();showScene(index+1);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden && dialog.open)setPlaying(false);});
  window.addEventListener('film-presence-left',()=>{if(!test && dialog.open)dialog.close();});
  dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);clearTimeout(revealTimer);token++;setPlaying(false);stage.replaceChildren();if(audioWasPlaying)audio.play().catch(()=>{});});
  return {close(){dialog.close();},open(){
    if(dialog.open || (!test && !canPlayFilm()))return false;
    playbackCycle=filmPlaybackState().cycle;completed=false;ended=false;
    $('.film-play').disabled=false;$('.film-seek').disabled=false;
    buildScenes();audioWasPlaying=!audio.paused;sound=true;updateSound();dialog.showModal();
    stage.replaceChildren();
    setPlaying(!document.hidden);showScene(0);frame=requestAnimationFrame(tick);$('.film-play').focus();
    return true;
  }};
}
