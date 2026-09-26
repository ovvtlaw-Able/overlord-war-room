import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReport} from '../site/schema.js';
import {demoReport} from '../site/demo.js';
import {objectivePoint,objectiveState} from '../site/map-data.js';
test('coordinates survive the relay schema without rounding and reject invalid bounds',()=>{
  const report=demoReport();const clean=validateReport(report);assert.deepEqual(clean.fronts[0].zones[0].position,{x:2538,y:5836});
  for(const bad of [{x:-1,y:0},{x:10001,y:0},{x:10.5,y:0},{x:0,y:Infinity},{x:'20',y:30}]){report.fronts[0].zones[0].position=bad;assert.throws(()=>validateReport(report));}
});
test('older reports without coordinates remain readable and do not acquire invented positions',()=>{
  const report=demoReport();delete report.fronts[0].zones[0].position;delete report.fronts[0].mapId;
  const clean=validateReport(report);assert.equal(clean.fronts[0].zones[0].position,undefined);assert.equal(clean.fronts[0].mapId,undefined);
});
test('map projects downward Y correctly; contested and unconfirmed owners do not masquerade as held',()=>{
  assert.deepEqual(objectivePoint({x:0,y:0}),[668,0]);assert.deepEqual(objectivePoint({x:10000,y:10000}),[0,1022]);
  assert.equal(objectiveState({status:'contested',owner:'Alliance'}),'contested');assert.equal(objectiveState({status:'unconfirmed',owner:'Horde'}),'unknown');assert.equal(objectiveState({status:'held',owner:'Horde'}),'horde');
});
