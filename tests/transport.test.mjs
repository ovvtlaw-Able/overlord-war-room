import test from 'node:test';
import assert from 'node:assert/strict';
import {Assembler,adler,parseSavedVariables} from '../scripts/protocol.mjs';
import {demoReport} from '../site/demo.js';
import {validateReport} from '../site/schema.js';
function frames(report,seq=1){
  const raw=Buffer.from(JSON.stringify(report));const count=Math.ceil(raw.length/740);
  return Array.from({length:count},(_,part)=>{
    const frame=Buffer.alloc(768),chunk=raw.subarray(part*740,(part+1)*740);
    frame.write('OVLR');frame[4]=1;frame.writeUInt32BE(seq,5);frame.writeUInt16BE(part,9);frame.writeUInt16BE(count,11);frame.writeUInt16BE(chunk.length,13);frame.writeUInt32BE(raw.length,15);frame.writeUInt32BE(adler(raw),19);chunk.copy(frame,24);frame.writeUInt32BE(adler(frame.subarray(0,764)),764);return frame;
  });
}
test('out-of-order optical frames reconstruct a report, suppress duplicates, preserve Unicode',()=>{
  const report=demoReport();report.mode='live';report.players[0].name='Éowyn-世界';const assembler=new Assembler();const packets=frames(report);let result;
  for(const packet of [...packets].reverse())result=assembler.accept(packet)||result;
  assert.deepEqual(result,validateReport(report));for(const p of packets)assert.equal(assembler.accept(p),null);
});
test('torn frames are rejected and a repeated cycle recovers missing packets',()=>{
  const report=demoReport();report.mode='live';const packets=frames(report);const broken=Buffer.from(packets[0]);broken[30]^=1;
  const a=new Assembler();assert.equal(a.accept(broken),null);for(const p of packets.slice(1))assert.equal(a.accept(p),null);assert.deepEqual(a.accept(packets[0]),validateReport(report));
});
test('generations are never combined',()=>{
  const report=demoReport();report.mode='live';const first=frames(report,1),second=frames(report,2),a=new Assembler();a.accept(first[0]);for(const p of second.slice(1))assert.equal(a.accept(p),null);assert.deepEqual(a.accept(second[0]),validateReport(report));
});
test('saved variable is extracted without executing Lua or publishing unrelated settings',()=>{
  const report=demoReport();report.mode='snapshot';const hex=Buffer.from(JSON.stringify({...report,account:'PRIVATE'})).toString('hex');
  const result=parseSavedVariables(`OverlordDB = { secret = "PRIVATE" }\nOverlordWebSnapshot = "${hex}"\nerror("do not execute")`);
  assert.equal(result.account,undefined);assert.deepEqual(result,validateReport(report));assert.throws(()=>parseSavedVariables('OverlordWebSnapshot = os.execute("bad")'));
});
test('schema rejects unbounded or malformed fields',()=>{
  const report=demoReport();report.players[0].kills=-1;assert.throws(()=>validateReport(report));report.players[0].kills=1;report.fronts.push(report.fronts[0]);assert.throws(()=>validateReport(report));
});
