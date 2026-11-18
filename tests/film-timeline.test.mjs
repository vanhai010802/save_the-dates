import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilmScenes, filmMilestones, filmTimeline } from '../assets/film-timeline.js';

test('cake film includes only dated milestones strictly before 19 October 2026', () => {
  const milestones = [
    {date:'2026-10-20',title:'After'},
    {date:'2026-10-19',title:'Cutoff'},
    {date:'2026-10-18',title:'Last included',media:[{url:'/last.jpg'}]},
    {date:'2026-04-28',title:'First'},
    {title:'Undated'},
  ];
  const original = structuredClone(milestones);
  assert.deepEqual(filmMilestones(milestones).map(memory => memory.title), ['First','Last included']);
  const scenes = buildFilmScenes({milestones});
  assert.deepEqual(scenes.filter(scene => scene.type === 'chapter').map(scene => scene.title), ['First','Last included']);
  assert.equal(scenes.filter(scene => scene.media).length, 1);
  assert.deepEqual(milestones, original, 'filtering the film leaves the live album unchanged');
});

test('runtime grows with content without compressing photos or long videos', () => {
  const video = {url:'https://example.test/clip.mp4',type:'video',duration:210000};
  const input = {milestones:[{date:'2026-10-18',media:[{url:'/one.jpg'},video]}],config:{anniversary_montage:[video,{url:'https://example.test/montage.jpg'}]}};
  const scenes = buildFilmScenes(input);
  assert.equal(scenes.filter(scene => scene.media?.type === 'video').length, 2);
  assert.ok(scenes.filter(scene => scene.media?.type === 'video').every(scene => scene.duration === 210000));
  assert.equal(scenes.find(scene => scene.media?.url === '/one.jpg').duration, 4500);
  assert.equal(scenes.find(scene => scene.type === 'montage' && scene.media.type === 'image').duration, 3000);
  const {total, offsets} = filmTimeline(scenes);
  assert.ok(total > 420000);
  assert.equal(total, scenes.reduce((sum, scene) => sum + scene.duration, 0));
  assert.equal(offsets.at(-1) + scenes.at(-1).duration, total);
  const short = buildFilmScenes();
  assert.ok(filmTimeline(short).total < 180000);
  assert.deepEqual(short.map(scene => scene.type), ['intro','outro']);
});

test('dense albums and longer captions still allow time to view and read', () => {
  const scenes = buildFilmScenes({milestones:[{date:'2026-05-01',description:'Một câu chuyện dài '.repeat(30),media:Array.from({length:5}, (_,index) => ({url:`/${index}.jpg`,caption:index === 0 ? 'Một dòng chú thích '.repeat(20) : ''}))}]});
  const photos = scenes.filter(scene => scene.type === 'photo');
  assert.equal(photos[1].duration, 3600);
  assert.ok(photos[0].duration > photos[1].duration);
  assert.ok(scenes.find(scene => scene.type === 'chapter').duration > 4000);
});
