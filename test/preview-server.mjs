import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('.');
const mock=`<script>
const key='pinterest.cleaner.root.v1';
const get=async()=>({[key]:JSON.parse(localStorage.getItem(key)||'null')});
window.chrome={storage:{local:{get}},runtime:{sendMessage:async(m)=>{
const mod=await import('/src/storage/settings.js');
const current=(await get())[key]||{};
const settings=mod.normalizeSettings(m.type==='PC_REPLACE_SETTINGS'?m.value:m.type==='PC_CLEAR_SETTINGS'?{}:{...current,...m.patch});
localStorage.setItem(key,JSON.stringify(settings));return {ok:true,settings};
}},tabs:{query:async()=>[]}};
</script>`;
createServer(async(req,res)=>{
try{
const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
const file=resolve(root,'.'+path);
if(!file.startsWith(root+'\\')){res.writeHead(403);return res.end();}
let body=await readFile(file);
if(path==='/src/options/options.html'||path==='/src/popup/popup.html')body=body.toString().replace('<head>','<head>'+mock);
res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[extname(file)]||'text/plain');res.end(body);
}catch{res.writeHead(404);res.end();}
}).listen(8765,'127.0.0.1',()=>console.log('Local settings preview http://127.0.0.1:8765/src/options/options.html'));
