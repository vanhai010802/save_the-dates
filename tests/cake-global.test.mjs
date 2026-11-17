import test from 'node:test';
import assert from 'node:assert/strict';
import { BlobNotFoundError } from '@vercel/blob-state';
import { createCakeStore, verifyCakePassword, CAKE_MARKER } from '../api/_cake.js';

test('simultaneous devices get exactly one global automatic cake; reset reopens once',async()=>{
  let saved=null,writes=0,deletes=0;
  const store=createCakeStore({
    headBlob:async path=>{assert.equal(path,CAKE_MARKER);if(!saved)throw new BlobNotFoundError();return saved;},
    putBlob:async(path,raw,options)=>{
      assert.equal(options.allowOverwrite,false);assert.equal(options.addRandomSuffix,false);
      if(saved)throw Error('Blob already exists');
      writes++;saved={url:'https://blob.test/'+path,etag:JSON.parse(raw).id};
      return saved;
    },
    deleteBlob:async(url,options)=>{assert.equal(options.ifMatch,saved.etag);assert.equal(url,saved.url);deletes++;saved=null;},
  });
  const first=await Promise.all([store.claim(),store.claim(),store.claim()]);
  assert.equal(first.filter(result=>result.show).length,1);assert.equal(writes,1);
  for(let i=0;i<20;i++)assert.equal((await store.claim()).show,false);
  assert.equal(writes,1,'later visits must not write a heartbeat or marker');
  await store.reset();assert.equal(deletes,1);
  assert.equal((await store.claim()).show,true);
  assert.equal((await store.claim()).show,false);assert.equal(writes,2);
});

test('reset password is checked on the server',()=>{
  assert.throws(()=>verifyCakePassword('wrong','6thang'),error=>error.status===401);
  assert.throws(()=>verifyCakePassword('','6thang'),error=>error.status===401);
  assert.doesNotThrow(()=>verifyCakePassword('6thang','6thang'));
});

test('blocked storage never grants a fake local automatic claim',async()=>{
  const store=createCakeStore({headBlob:async()=>{throw Error('store blocked');}});
  await assert.rejects(store.claim(),/store blocked/);
  await assert.rejects(store.reset(),/store blocked/);
});
