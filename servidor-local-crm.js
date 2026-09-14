'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const {URL}=require('url');
const ROOT=__dirname;
const PORT=Number(process.env.PORT||5500);
const HOST=process.env.HOST||'127.0.0.1';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8','.webmanifest':'application/manifest+json'};
function safePath(urlPath){
 let decoded;
 try{decoded=decodeURIComponent(urlPath)}catch(_){decoded=urlPath}
 decoded=decoded.replace(/\\/g,'/');
 const normalized=path.posix.normalize('/'+decoded).replace(/^\/+/, '');
 if(normalized.includes('..'))return null;
 return normalized;
}
function resolveRequest(requestPath){
 const rel=safePath(requestPath);
 if(rel===null)return null;
 const candidates=[];
 if(!rel)candidates.push('login.html','index.html');
 else{
   candidates.push(rel);
   if(!rel.toLowerCase().endsWith('.html'))candidates.push(rel+'.html');
   candidates.push(path.join(rel,'index.html'));
 }
 for(const item of candidates){
   const abs=path.resolve(ROOT,item);
   if(!abs.startsWith(path.resolve(ROOT)+path.sep)&&abs!==path.resolve(ROOT))continue;
   try{if(fs.statSync(abs).isFile())return abs}catch(_){}
 }
 return null;
}
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const file=resolveRequest(u.pathname);
 if(!file){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><meta charset="utf-8"><title>404</title><body style="font-family:Segoe UI;background:#07101d;color:#fff;padding:32px"><h1>404</h1><p>No se encontró esta ruta en la simulación local de Nexus Obsidian.</p><p><a style="color:#60a5fa" href="/login">Ir al inicio de sesión</a></p></body>');return}
 const ext=path.extname(file).toLowerCase();
 const headers={'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Expires':'0','X-Content-Type-Options':'nosniff'};
 res.writeHead(200,headers);
 const stream=fs.createReadStream(file);stream.on('error',()=>{if(!res.headersSent)res.writeHead(500);res.end()});stream.pipe(res);
});
server.listen(PORT,HOST,()=>{
 console.log('');
 console.log('Nexus Obsidian CRM - simulacion local');
 console.log('-------------------------------------');
 console.log(`Servidor: http://${HOST}:${PORT}`);
 console.log(`Login:    http://${HOST}:${PORT}/login`);
 console.log('');
 console.log('Mantén esta ventana abierta mientras uses el CRM.');
 console.log('Presiona Ctrl+C para detener el servidor.');
 console.log('');
});
server.on('error',err=>{if(err.code==='EADDRINUSE'){console.error(`El puerto ${PORT} ya está en uso. Cierra la otra simulación o usa: set PORT=5501 && node servidor-local-crm.js`)}else console.error(err);process.exitCode=1});
