import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {parseArgs} from 'node:util';
import {Assembler,parseSavedVariables} from './protocol.mjs';
const {values:args}=parseArgs({options:{source:{type:'string'},output:{type:'string'},live:{type:'boolean'},watch:{type:'boolean'},endpoint:{type:'string'},x:{type:'string',default:'16'},y:{type:'string',default:'16'},cell:{type:'string',default:'4'}}});
const output=path.resolve(args.output||fileURLToPath(new URL('../site/data/latest.json',import.meta.url)));
const token=process.env.OVERLORD_UPLOAD_TOKEN;
if(args.endpoint){const url=new URL(args.endpoint);if(url.protocol!=='https:' && !['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Upload endpoint must use HTTPS');if(!token)throw new Error('Set OVERLORD_UPLOAD_TOKEN in this shell before uploading.');}
let pending=null,writing=false,lastPublished=0;
async function deliver(report){
  pending=report;
  if(writing)return;
  writing=true;
  try {
    while(pending){
      const next=pending;pending=null;
      await mkdir(path.dirname(output),{recursive:true});
      const raw=JSON.stringify(next);
      await writeFile(output+'.tmp',raw+'\n','utf8');await rename(output+'.tmp',output);
      if(args.endpoint){
        const response=await fetch(args.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:raw,signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw new Error(`Upload rejected (${response.status})`);
      }
      lastPublished=next.generatedAt;
      console.log(`${new Date().toLocaleTimeString()} · ${next.fronts.length} fronts · ${next.players.length} ranked players · ${args.endpoint?'uploaded':'saved locally'}`);
    }
  }catch(err){console.error(`Bridge: ${err.message}. Waiting for next report.`);}
  finally{writing=false;}
}
if(args.live){
  if(process.platform!=='win32')throw new Error('The optical capture companion currently supports Windows.');
  for(const key of ['x','y','cell'])if(!/^\d+$/.test(args[key]))throw new Error(`Invalid ${key}`);
  console.log('Live reader started. Run /ov web live in WoW. Only the 256 × 128 telemetry panel is sampled; no images are saved or uploaded. Ctrl+C stops.');
  const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./capture-panel.ps1',import.meta.url)),'-OffsetX',args.x,'-OffsetY',args.y,'-CellSize',args.cell],{windowsHide:true,stdio:['ignore','pipe','inherit']});
  const assembler=new Assembler();
  createInterface({input:child.stdout}).on('line',line=>{const report=assembler.accept(Buffer.from(line,'base64'));if(report && report.generatedAt>=lastPublished)void deliver(report);});
  child.on('error',err=>{console.error(err.message);process.exitCode=1;});
  child.on('exit',code=>{if(code)console.error(`Panel reader exited (${code}).`);process.exitCode=code||0;});
  process.on('SIGINT',()=>{child.kill();process.exit();});
}else{
  if(!args.source)throw new Error('Supply --live or --source "path/to/SavedVariables/Overlord.lua" [--watch].');
  async function read(){try{const report=parseSavedVariables(await readFile(args.source,'utf8'));if(report.generatedAt>lastPublished)await deliver(report);}catch(err){console.error(err.message);if(!args.watch)process.exitCode=1;}}
  await read();if(args.watch)setInterval(read,2000);
}
