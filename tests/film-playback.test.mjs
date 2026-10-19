import test from 'node:test';
import assert from 'node:assert/strict';
import { updateFilmPlayback, canPlayFilm, completeFilmPlayback, filmPlaybackState, stopFilmPlayback } from '../assets/film-playback.js';

test('completed playback stays locked until a new reset cycle with both users ready', () => {
  const previous={window:globalThis.window,document:globalThis.document};
  const events=[];
  globalThis.window={dispatchEvent:event=>events.push(event)};
  globalThis.document={hidden:false};
  try{
    assert.equal(canPlayFilm(),false);
    updateFilmPlayback({resetCycle:'first',together:true,locked:false});
    assert.equal(canPlayFilm(),true);
    completeFilmPlayback('first');
    assert.equal(canPlayFilm(),false);assert.equal(filmPlaybackState().locked,true);
    assert.equal(events.filter(event=>event.type==='film-complete').length,1);
    updateFilmPlayback({resetCycle:'first',together:true,locked:false});
    assert.equal(canPlayFilm(),false,'an older heartbeat cannot undo local completion');
    updateFilmPlayback({resetCycle:'second',together:false,locked:false});
    assert.equal(canPlayFilm(),false);assert.equal(filmPlaybackState().locked,false);
    updateFilmPlayback({resetCycle:'second',together:true,locked:false});
    completeFilmPlayback('first');assert.equal(canPlayFilm(),true,'late completion from before reset is ignored');
    document.hidden=true;assert.equal(canPlayFilm(),false);document.hidden=false;
    stopFilmPlayback();assert.equal(canPlayFilm(),false);
    updateFilmPlayback({resetCycle:'second',together:false,locked:true});assert.equal(filmPlaybackState().locked,true);
  }finally{
    for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
  }
});
