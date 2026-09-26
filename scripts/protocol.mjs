import {validateReport,MAX_BYTES} from '../site/schema.js';
export function adler(bytes) {let a=1,b=0;for(const c of bytes){a=(a+c)%65521;b=(b+a)%65521;}return (b*65536+a)>>>0;}
export function parseSavedVariables(raw) {
  const match=raw.match(/^OverlordWebSnapshot\s*=\s*"([0-9a-f]+)"\s*$/m);
  if(!match || match[1].length%2 || match[1].length>MAX_BYTES*2) throw new Error('No valid public snapshot. Enable /ov web on, then /reload.');
  return validateReport(JSON.parse(Buffer.from(match[1],'hex').toString('utf8')));
}
export class Assembler {
  constructor(){this.state=null;this.completed=null;}
  accept(frame) {
    if(frame.length!==768 || frame.toString('ascii',0,4)!=='OVLR' || frame[4]!==1) return null;
    if(adler(frame.subarray(0,764))!==frame.readUInt32BE(764)) return null;
    const seq=frame.readUInt32BE(5),part=frame.readUInt16BE(9),count=frame.readUInt16BE(11),length=frame.readUInt16BE(13),total=frame.readUInt32BE(15),checksum=frame.readUInt32BE(19);
    if(!total || total>MAX_BYTES || count!==Math.ceil(total/740) || part>=count || length!==Math.min(740,total-part*740)) return null;
    const key=`${seq}:${total}:${checksum}`;
    if(this.completed===key) return null;
    if(!this.state || this.state.key!==key) this.state={key,count,total,checksum,parts:new Map(),started:Date.now()};
    const s=this.state;
    if(Date.now()-s.started>120000){this.state=null;return null;}
    s.parts.set(part,frame.subarray(24,24+length));
    if(s.parts.size!==count) return null;
    const raw=Buffer.concat(Array.from({length:count},(_,i)=>s.parts.get(i)));
    if(raw.length!==total || adler(raw)!==checksum){this.state=null;return null;}
    try {const report=validateReport(JSON.parse(raw.toString('utf8')));if(report.mode!=='live')return null;this.completed=key;this.state=null;return report;}
    catch {this.state=null;return null;}
  }
}
