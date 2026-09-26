import {validateReport,MAX_BYTES} from '../site/schema.js';
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers});
async function authorized(request,secret){
  if(!secret || secret.length<32)return false;
  const got=request.headers.get('Authorization')||'';
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([got,`Bearer ${secret}`].map(s=>crypto.subtle.digest('SHA-256',encoder.encode(s))));
  const aa=new Uint8Array(a),bb=new Uint8Array(b);let difference=0;for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];return difference===0;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname!=='/latest')return reply(404,{error:'Not found'});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(!['GET','POST','DELETE'].includes(request.method))return reply(405,{error:'Method not allowed'});
    if(request.method!=='GET' && !await authorized(request,env.UPLOAD_TOKEN))return reply(401,{error:'Unauthorized'});
    if(request.method==='POST'){
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{error:'Expected JSON'});
      if(Number(request.headers.get('Content-Length'))>MAX_BYTES)return reply(413,{error:'Report too large'});
      const reader=request.body?.getReader();if(!reader)return reply(400,{error:'Missing report'});
      let bytes=0;const chunks=[];
      while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.length;if(bytes>MAX_BYTES){await reader.cancel();return reply(413,{error:'Report too large'});}chunks.push(value);}
      let report;
      try{
        const raw=new Uint8Array(bytes);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
        report=validateReport(JSON.parse(new TextDecoder().decode(raw)));
      }catch{return reply(400,{error:'Invalid report'});}
      if(report.mode!=='live' || Math.abs(Date.now()/1000-report.generatedAt)>120)return reply(400,{error:'Expected a recent live report'});
      request=new Request(request.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(report)});
    }
    const id=env.REPORTS.idFromName('primary-reporter');
    const response=await env.REPORTS.get(id).fetch(request);
    return new Response(response.body,{status:response.status,headers});
  },
};
// One trusted reporter. Reports replace one another; independent observers are
// deliberately not summed, which would double-count shared addon scores.
export class ReportStore {
  constructor(ctx){this.ctx=ctx;}
  async fetch(request){
    if(request.method==='GET'){
      const stored=await this.ctx.storage.get('latest');
      return stored ? reply(200,stored) : reply(404,{error:'No reporter connected'});
    }
    if(request.method==='DELETE'){await this.ctx.storage.delete('latest');return reply(200,{deleted:true});}
    const report=await request.json();
    return this.ctx.storage.transaction(async txn=>{
      const previous=await txn.get('latest');
      if(previous && report.generatedAt<=previous.generatedAt)return reply(409,{error:'Report is not newer'});
      await txn.put('latest',report);return reply(200,{accepted:true,generatedAt:report.generatedAt});
    });
  }
}
