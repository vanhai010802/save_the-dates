import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { transitionPresence } from '../api/_presence-state.js';
import { validVisitor } from '../api/_presence.js';
const root = resolve(fileURLToPath(new URL('../',import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mp3':'audio/mpeg','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.json':'application/json; charset=utf-8'};
let snapshot;
const uploads=new Map();
let presenceState=null;
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Cache-Control','no-store');
  if(url.pathname==='/admin' || url.pathname==='/admin.html'){res.writeHead(302,{Location:'/our-story'});res.end();return;}
  if(url.pathname.startsWith('/__preview/media/')){const item=uploads.get(url.pathname);if(!item){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',item.type);res.end(item.body);return;}
  if(url.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(url.pathname==='/api/presence' && req.method==='POST'){
      try{
        const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());
        if(body.action==='reset'){
          if(req.headers['x-admin-password']!=='demo'){res.writeHead(401);res.end('{"error":"Sai mật khẩu"}');return;}
        }else if(!validVisitor(body.visitorId) || !validVisitor(body.userId) || typeof body.active!=='boolean' || !Number.isSafeInteger(body.sequence) || body.sequence<1)throw Error('invalid');
        const now=Date.now(),next=transitionPresence(presenceState,body,now,`${now}_${randomUUID()}`);
        presenceState=next.state;res.end(JSON.stringify(next.result));
      }catch{res.writeHead(400);res.end('{"error":"Thiết bị không hợp lệ"}');}return;
    }
    // Local preview reads the public existing data. It never writes to production.
    if(url.pathname==='/api/data' && req.method==='GET'){
      try{if(!snapshot){const response=await fetch('https://savethedates.vercel.app/api/data');if(!response.ok)throw Error('upstream');snapshot=await response.json();}res.end(JSON.stringify({...snapshot,preview:true}));}catch{res.writeHead(502);res.end(JSON.stringify({error:'Không tải được dữ liệu website hiện tại.'}));}return;
    }
    if(req.headers['x-admin-password']!=='demo'){res.writeHead(401);res.end(JSON.stringify({error:'Bản xem thử: dùng mật khẩu demo. Các thay đổi chỉ lưu tạm trên máy.'}));return;}
    if(url.pathname==='/api/auth' && req.method==='POST'){res.end('{"ok":true}');return;}
    if(!snapshot){res.writeHead(503);res.end('{"error":"Hãy tải lại trang để đọc dữ liệu trước."}');return;}
    if(url.pathname==='/api/demo-upload' && req.method==='POST'){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>15*1024*1024){res.writeHead(413);res.end('{"error":"Ảnh vượt quá 15 MB."}');return;}chunks.push(chunk);}
      const type=req.headers['content-type'];if(!['image/jpeg','image/png','image/webp','image/gif'].includes(type)){res.writeHead(400);res.end('{"error":"Định dạng ảnh không hợp lệ."}');return;}
      const path=`/__preview/media/${randomUUID()}`;uploads.set(path,{body:Buffer.concat(chunks),type});res.end(JSON.stringify({url:`http://127.0.0.1:4173${path}`}));return;
    }
    if(url.pathname==='/api/milestones' && req.method==='DELETE'){snapshot.milestones=snapshot.milestones.filter(m=>m.id!==url.searchParams.get('id'));res.end('{"ok":true}');return;}
    if(req.method==='POST' && ['/api/config','/api/milestones'].includes(url.pathname)){
      try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString());if(url.pathname==='/api/config')snapshot.config={...snapshot.config,...body};else{const index=snapshot.milestones.findIndex(m=>m.id===body.id);if(index<0)snapshot.milestones.push(body);else snapshot.milestones[index]=body;}res.end('{"ok":true}');}catch{res.writeHead(400);res.end('{"error":"Dữ liệu không hợp lệ."}');}return;
    }
    res.writeHead(404);res.end('{"error":"API không có trong bản xem thử."}');return;
  }
  const routes={'/':'anniversary.html','/our-story':'index.html'};
  try{const path=resolve(root,routes[url.pathname] || '.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep) || /(^|[\\/])\./.test(path.slice(root.length+1)) || path.startsWith(resolve(root,'api')+sep)){res.writeHead(403);res.end('Forbidden');return;}const content=await readFile(path);res.setHeader('Content-Type',types[extname(path)] || 'application/octet-stream');res.end(content);}catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Anniversary preview: http://127.0.0.1:4173 · Admin: http://127.0.0.1:4173/admin'));
