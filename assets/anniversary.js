import { createMemoryFilm } from './memory-film.js';
import { withMontageAssets } from './montage-data.js';
import { startTogetherPresence } from './together-presence.js';
const $ = id => document.getElementById(id);
const state = { config: {}, milestones: [] };
let selectedMonth = 'all', currentMemory, currentPhoto = 0, toastTimer;
let dataReady = false;
const film = $('cake-button') ? createMemoryFilm(() => state) : null;
export function toast(message) {
  const el = $('toast'); el.textContent = message; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 4500);
}
export async function request(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Không thể kết nối máy chủ (${response.status}).`);
  return data;
}
export function element(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className;
  if (text !== undefined) el.textContent = text; return el;
}
export function safeMedia(url) {
  try { const parsed = new URL(url); if (parsed.protocol === 'http:') parsed.protocol = 'https:'; return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; }
}
function dateLabel(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date.split('-').reverse().join('.') : '';
}
function renderConfig() {
  const c = state.config;
  const months = Math.max(1, Math.min(1200, Number(c.anniversary_months) || 6));
  $('anniversary-title').replaceChildren(document.createTextNode('Happy '), element('em', '', `${months} months`), document.createElement('br'), document.createTextNode('anniversary'), element('span', 'title-heart', '♡'));
  $('candle-number').textContent = months;
  document.querySelector('.date-stamp b').textContent = months;
  if (c.anniversary_title) { $('hero-description').textContent = c.anniversary_title; $('hero-description').style.whiteSpace = 'pre-line'; }
  if (c.anniversary_message) $('love-message').textContent = c.anniversary_message;
  $('couple-names').replaceChildren(document.createTextNode(c.person1_name || 'Hải'), element('span', '', '&'), document.createTextNode(c.person2_name || 'Yên'));
  $('couple-date').textContent = `Bên nhau từ ${dateLabel(c.start_date || '2026-04-28')}`;
  if (c.start_date) {
    const [y,m,d] = c.start_date.split('-').map(Number);
    const firstOfTarget = new Date(Date.UTC(y,m - 1 + months,1));
    const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(),firstOfTarget.getUTCMonth()+1,0)).getUTCDate();
    firstOfTarget.setUTCDate(Math.min(d,lastDay));
    $('anniversary-date').textContent = dateLabel(firstOfTarget.toISOString().slice(0,10));
  }
  $('couple-avatars').replaceChildren();
  ['person1','person2'].forEach((key,i) => {
    const url = safeMedia(c[`${key}_avatar_url`]);
    if (url) { const img = element('img'); img.src = url; img.alt = c[`${key}_name`] || `Người thương ${i+1}`; $('couple-avatars').append(img); }
    else $('couple-avatars').append(element('span','',(c[`${key}_name`] || (i ? 'Y' : 'H')).slice(0,1)));
  });
}
function renderMemories() {
  const memories = [...state.milestones].sort((a,b) => (a.date || '').localeCompare(b.date || '')).filter(m => selectedMonth === 'all' || m.date?.slice(0,7) === selectedMonth);
  $('memory-count').textContent = `${memories.length} khoảnh khắc`;
  $('memory-grid').replaceChildren();
  memories.forEach(memory => {
    const card = element('button','memory-card'); card.type = 'button';
    card.setAttribute('aria-label', `Xem kỷ niệm: ${memory.title}`);
    const frame = element('div','memory-image'); const media = memory.media?.find(m => safeMedia(m.url));
    if (media) {
      const image = element(media.type === 'video' ? 'video' : 'img'); image.src = safeMedia(media.url);
      if (media.type === 'video') { image.muted = true; image.preload = 'metadata'; image.setAttribute('playsinline',''); }
      else { image.alt = memory.title || 'Khoảnh khắc của chúng mình'; image.loading = 'lazy'; image.addEventListener('error',()=>image.replaceWith(element('div','memory-placeholder','♡'))); }
      frame.append(image);
      frame.append(element('span','image-count', `${media.type === 'video' ? '▷ ' : '▧ '}${memory.media.length}`));
    } else frame.append(element('div','memory-placeholder',memory.emoji || '♡'));
    const copy = element('div','card-copy');
    copy.append(element('span','card-date',dateLabel(memory.date)),element('h3','',memory.title || 'Một ngày có nhau'),element('p','',memory.description || 'Một khoảnh khắc nhỏ, một kỷ niệm thật lâu.'));
    card.append(frame,copy); card.addEventListener('click',()=>openMemory(memory)); $('memory-grid').append(card);
  });
  $('data-status').hidden = memories.length > 0;
  if (!memories.length) $('data-status').textContent = 'Chiếc hộp kỷ niệm đang chờ những tấm hình đầu tiên. Thêm một khoảnh khắc trong Góc của chúng mình nhé.';
}
function openMemory(memory) {
  currentMemory = memory; currentPhoto = 0;
  $('dialog-title').textContent = memory.title;
  $('dialog-description').textContent = memory.description || 'Một khoảnh khắc nhỏ, một kỷ niệm thật lâu.';
  $('dialog-date').textContent = dateLabel(memory.date);
  renderPhoto(); $('memory-dialog').showModal();
}
function renderPhoto() {
  const media = (currentMemory.media || []).filter(m => safeMedia(m.url));
  let caption = document.getElementById('dialog-photo-caption');
  if (!caption) { caption=element('p','photo-caption-text');caption.id='dialog-photo-caption';$('dialog-description').after(caption); }
  caption.textContent = media[currentPhoto]?.caption || '';caption.hidden=!caption.textContent;
  $('dialog-media').replaceChildren();
  if (media.length) {
    const item = media[currentPhoto]; const el = element(item.type === 'video' ? 'video' : 'img');
    el.src = safeMedia(item.url);
    if (item.type === 'video') { el.controls = true; el.playsInline = true; }
    else el.alt = `${currentMemory.title} — ảnh ${currentPhoto+1}`;
    $('dialog-media').append(el);
  } else $('dialog-media').append(element('div','memory-placeholder','♡'));
  $('photo-counter').textContent = media.length ? `${currentPhoto+1} / ${media.length}` : 'Chỉ cần mình nhớ';
  $('previous-photo').disabled = media.length < 2; $('next-photo').disabled = media.length < 2;
}
function movePhoto(offset) {
  const count = currentMemory?.media?.filter(m=>safeMedia(m.url)).length || 0;
  if (count) { currentPhoto = (currentPhoto + offset + count) % count; renderPhoto(); }
}
async function load() {
  $('data-status').hidden = false;
  try {
    const data = await withMontageAssets(await request('/api/data')); state.config = data.config || {}; state.milestones = Array.isArray(data.milestones) ? data.milestones : [];
    renderConfig();
    const filters = $('memory-filters'); filters.replaceChildren();
    const months = [...new Set(state.milestones.map(m=>m.date?.slice(0,7)).filter(Boolean))].sort();
    [['all','Tất cả kỷ niệm'],...months.map(m=>[m,`Tháng ${Number(m.slice(5))}${new Set(months.map(x=>x.slice(0,4))).size > 1 ? `/${m.slice(0,4)}` : ''}`])].forEach(([value,label])=>{
      const button = element('button', value === selectedMonth ? 'selected' : '', label); button.dataset.month = value; button.setAttribute('aria-pressed',String(value===selectedMonth));
      button.addEventListener('click',()=>{selectedMonth=value;filters.querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});renderMemories();}); filters.append(button);
    }); renderMemories(); dataReady = true;startTogetherPresence(()=>state);
  } catch {
    $('data-status').replaceChildren(document.createTextNode('Chưa mở được chiếc hộp kỷ niệm. '));
    const retry = element('button','','Thử lại'); retry.addEventListener('click',load); $('data-status').append(retry);
  }
}
async function toggleMusic() {
  const audio = $('background-music');
  if (audio.paused) { try { await audio.play(); } catch { toast('Chạm vào nút nhạc một lần nữa để bật giai điệu nhé.'); } }
  else audio.pause();
}
function revealMemories() {
  if (!dataReady) { toast('Chờ chiếc hộp kỷ niệm tải xong rồi mình bắt đầu nhé.'); return; }
  document.querySelector('.cake-scene').classList.add('candles-out');
  film.open();
}
if ($('cake-button')) {
  $('open-memories').addEventListener('click',revealMemories); $('cake-button').addEventListener('click',revealMemories);
  $('scroll-memories').addEventListener('click',()=>document.querySelector('.cake-scene').classList.add('candles-out'));
  $('music-toggle').addEventListener('click',toggleMusic);
  ['play','pause'].forEach(event=>$('background-music').addEventListener(event,()=>{const playing=!$('background-music').paused;$('music-toggle').setAttribute('aria-pressed',String(playing));$('music-toggle').setAttribute('aria-label',playing?'Tắt nhạc nền':'Bật nhạc nền');}));
  document.querySelector('.dialog-close').addEventListener('click',()=>$('memory-dialog').close());
  $('memory-dialog').addEventListener('close',()=>{$('dialog-media').querySelectorAll('video').forEach(v=>v.pause());});
  $('memory-dialog').addEventListener('click',e=>{if(e.target===$('memory-dialog')){const rect=e.target.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)e.target.close();}});
  $('previous-photo').addEventListener('click',()=>movePhoto(-1)); $('next-photo').addEventListener('click',()=>movePhoto(1));
  document.addEventListener('keydown',e=>{if($('memory-dialog').open){if(e.key==='ArrowLeft')movePhoto(-1);if(e.key==='ArrowRight')movePhoto(1);}});
  load();
}
