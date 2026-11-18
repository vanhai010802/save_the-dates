import { montageItems } from './montage-data.js';

// The cake film covers the memories before 19 October, not the live album.
export const FILM_CUTOFF = '2026-10-19';
export const FILM_FADE_MS = 300;

export function filmMilestones(milestones = []) {
  return milestones.filter(memory => /^\d{4}-\d{2}-\d{2}$/.test(memory.date || '') && memory.date < FILM_CUTOFF)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const readingTime = (minimum, ...text) => Math.max(minimum, Math.min(14000, 1200 + text.join(' ').trim().split(/\s+/u).length * 260));
const videoTime = media => Math.max(1000, Math.min(600000, Number(media.duration) || 6000));
const formatDate = value => value.split('-').reverse().join('.');

export function buildFilmScenes({ config = {}, milestones = [] } = {}, safeURL = value => value) {
  const months = Math.max(1, Math.min(1200, Number(config.anniversary_months) || 6));
  const intro = {type:'intro',kicker:'MỘT CHIẾC BÁNH. MỘT ĐIỀU ƯỚC.',title:`${months} tháng có nhau.`,description:config.anniversary_title || 'Nếu được chọn lại từ đầu, anh vẫn sẽ chọn gặp em.'};
  intro.duration = readingTime(4500, intro.title, intro.description);
  const scenes = [intro];
  filmMilestones(milestones).forEach((memory, chapter) => {
    const title = memory.title || 'Một ngày có nhau';
    const description = memory.description || 'Có những ngày, chỉ cần ở cạnh nhau là đủ.';
    scenes.push({type:'chapter',duration:readingTime(4000, title, description),kicker:`CHƯƠNG ${String(chapter+1).padStart(2,'0')} · ${formatDate(memory.date)}`,title,description,emoji:memory.emoji || '♡'});
    const items = (memory.media || []).filter(media => safeURL(media.url));
    const photoDuration = items.filter(media => media.type !== 'video').length >= 4 ? 3600 : 4500;
    items.forEach((media, photo) => scenes.push({type:'photo',duration:media.type === 'video' ? videoTime(media) : readingTime(photoDuration, media.caption || ''),media,kicker:formatDate(memory.date),title,description:media.caption || memory.description || 'Một khoảnh khắc nhỏ. Một kỷ niệm thật lâu.',photo,chapter}));
  });
  const montage = montageItems(config.anniversary_montage).filter(media => safeURL(media.url));
  if (montage.length) {
    scenes.push({type:'chapter',duration:4000,kicker:'OUR MOMENTS',title:'Những khoảnh khắc của đôi ta',description:''});
    montage.forEach((media, photo) => scenes.push({type:'montage',duration:media.type === 'video' ? videoTime(media) : 3000,media,title:`Những khoảnh khắc của đôi ta — ${media.type === 'video' ? 'video' : 'ảnh'} ${photo+1}`,photo}));
  }
  const outro = {type:'outro',kicker:'VÀ CÂU CHUYỆN VẪN ĐANG TIẾP TỤC…',title:'Mình còn cả mai sau.',description:config.anniversary_message || 'Cảm ơn em vì những ngày đã qua.\nMình cứ nắm tay nhau, viết tiếp những tháng năm thật đẹp nhé.',names:`${config.person1_name || 'Hải'} & ${config.person2_name || 'Yên'}`};
  outro.duration = readingTime(6800, outro.title, outro.description);
  scenes.push(outro);
  return scenes;
}

export function filmTimeline(scenes) {
  let total = 0;
  const offsets = scenes.map(scene => {
    const start = total;
    total += scene.duration;
    return start;
  });
  return {offsets, total};
}
