import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{ReportStore} from '../relay/worker.mjs';
import {demoReport} from '../site/demo.js';
const secret='test-only-secret-with-at-least-32-characters';
function environment(){
  const map=new Map(),storage={get:async k=>map.get(k),put:async(k,v)=>map.set(k,v),delete:async k=>map.delete(k),transaction:async fn=>fn(storage)};
  const store=new ReportStore({storage});return {UPLOAD_TOKEN:secret,REPORTS:{idFromName:()=>1,get:()=>store}};
}
function request(method='GET',report,auth=secret){return new Request('https://example.com/latest',{method,headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},...(report?{body:JSON.stringify(report)}:{})});}
test('public reads, authenticated writes, stale rejection, deletion and allowlisted fields',async()=>{
  const env=environment(),report=demoReport();report.mode='live';report.accountId='must not publish';
  assert.equal((await worker.fetch(request(),env)).status,404);
  assert.equal((await worker.fetch(request('POST',report,'wrong'),env)).status,401);
  assert.equal((await worker.fetch(request('POST',report),env)).status,200);
  const received=await worker.fetch(request(),env);assert.equal(received.headers.get('Access-Control-Allow-Origin'),'*');assert.equal((await received.json()).accountId,undefined);
  assert.equal((await worker.fetch(request('POST',report),env)).status,409);
  report.generatedAt-=600;assert.equal((await worker.fetch(request('POST',report),env)).status,400);
  assert.equal((await worker.fetch(request('DELETE',undefined,'wrong'),env)).status,401);
  assert.equal((await worker.fetch(request('DELETE'),env)).status,200);
  assert.equal((await worker.fetch(request(),env)).status,404);
});
test('invalid and demo reports cannot enter the live feed',async()=>{
  const env=environment();assert.equal((await worker.fetch(request('POST',demoReport()),env)).status,400);
  assert.equal((await worker.fetch(request('POST',{mode:'live'}),env)).status,400);
});
