import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../design-system/flight-progress.js',import.meta.url),'utf8');
const Progress=vm.runInNewContext(source.split('const flightProgress=')[0]+'\nFlightProgressStore');
const t=1700000000000,point=(seconds,lon,alt=10000,extra={})=>({hex:'3c1234',r:'D-ABCD',flight:'DLH123',lat:50,lon:8+lon,alt_baro:alt,positionTime:t+seconds*1000,...extra});
const read=(s,a,time=a.positionTime)=>s.forAircraft(a,time),plain=x=>JSON.parse(JSON.stringify(x));
function departure(){const s=new Progress();s.ingest([point(0,0,'ground'),point(30,.02,1000),point(60,.06,2000)],t+60000);return s}
test('only a confirmed observed ground-to-air transition earns airborne time and distance covered',()=>{
 const s=new Progress();s.ingest([point(0,0,'ground'),point(30,.02,1000)],t+30000);assert.equal(read(s,point(30,.02)).timeLabel,'Time observed');
 s.ingest([point(60,.06,2000),point(90,.1,3000)],t+90000);const p=read(s,point(90,.1));assert.equal(p.timeLabel,'Time airborne');assert.equal(p.elapsedMinutes,1);assert.equal(p.distanceLabel,'Distance covered');assert.ok(p.distanceKm>5&&p.distanceKm<6);assert.deepEqual(plain(p.takeoffWindow),[t,t+30000]);
});
test('first observed airborne position has no fabricated distance and starts a partial record',()=>{
 const s=new Progress();s.ingest([point(30,.1)],t+30000);const p=read(s,point(30,.1));assert.equal(p.distanceKm,null);assert.equal(p.elapsedMinutes,0);assert.equal(p.distanceLabel,'Observed distance');assert.equal(p.timeLabel,'Time observed');
 s.ingest([point(90,.2)],t+90000);assert.equal(read(s,point(90,.2)).elapsedMinutes,1);assert.ok(read(s,point(90,.2)).distanceKm>7);
});
test('duplicate and out-of-order reports cannot add distance or replace identity',()=>{
 const s=departure(),p=read(s,point(60,.06));s.ingest([point(60,.5),point(40,.5,2000,{flight:'OLD'}),point(60,.06)],t+60000);assert.deepEqual(plain(read(s,point(60,.06))),plain(p));assert.equal(s.records.size,1);
});
test('delayed scene time interpolates only the accepted segment and agrees at the same scene time',()=>{
 const s=departure();s.ingest([point(90,.1),point(120,.14)],t+120000);const a=point(120,.14),live=read(s,a),wall=read(s,a,t+90000),fraction=read(s,a,t+105000);
 assert.ok(wall.distanceKm<live.distanceKm);assert.ok(Math.abs(fraction.distanceKm-(wall.distanceKm+live.distanceKm)/2)<1e-8);assert.deepEqual(plain(read(s,a,t+90000)),plain(wall));assert.equal(read(s,a,t-1),null);
});
test('a held or absent signal cannot advance elapsed time or distance from wall time',()=>{
 const s=departure(),a=point(60,.06),p=read(s,a);assert.deepEqual(plain(read(s,a,t+1000000)),plain(p));
});
test('a gap beyond two minutes breaks distance coverage without discarding observed departure time',()=>{
 const s=departure(),before=read(s,point(60,.06));s.ingest([point(240,.9)],t+240000);const p=read(s,point(240,.9));assert.equal(p.distanceKm,before.distanceKm);assert.equal(p.distanceLabel,'Observed distance');assert.equal(p.timeLabel,'Time airborne');assert.equal(p.elapsedMinutes,3);assert.equal(read(s,point(240,.9),t+120000).distanceKm,before.distanceKm);
});
test('a reception gap beyond thirty minutes starts a new partial physical session',()=>{
 const s=departure();s.ingest([point(1900,.2)],t+1900000);const p=read(s,point(1900,.2));assert.equal(s.records.size,2);assert.equal(p.takeoff,null);assert.equal(p.timeLabel,'Time observed');assert.equal(p.distanceKm,null);
});
test('callsign changes preserve physical flight progress while a tail reassignment cannot join records',()=>{
 const s=departure();s.ingest([point(90,.1,3000,{flight:'DLH999'})],t+90000);assert.equal(s.records.size,1);assert.equal(read(s,point(90,.1)).takeoff,t+30000);
 s.ingest([point(120,.14,3000,{r:'D-OTHER'})],t+120000);assert.equal(s.records.size,2);assert.equal(read(s,point(120,.14,3000,{r:'D-OTHER'})).takeoff,null);assert.equal(read(s,point(120,.14,3000,{r:'D-ABCD'})).takeoff,t+30000);
});
test('impossible jumps are rejected without poisoning the next usable anchor',()=>{
 const s=departure(),before=read(s,point(60,.06));s.ingest([point(90,90)],t+90000);assert.equal(read(s,point(90,90)).distanceKm,before.distanceKm);s.ingest([point(100,.1)],t+100000);assert.ok(read(s,point(100,.1)).distanceKm>before.distanceKm);
});
test('unknown airborne state cannot create a takeoff and leaves a distance gap',()=>{
 const s=departure();s.ingest([point(90,.1,null),point(120,.14)],t+120000);assert.equal(read(s,point(120,.14)).distanceLabel,'Observed distance');assert.equal(read(s,point(120,.14)).timeLabel,'Time airborne');
});
test('landing stops elapsed time, taxi is excluded, and a subsequent observed departure starts a new flight',()=>{
 const s=departure();s.ingest([point(90,.1,3000),point(120,.11,'ground'),point(150,.12,'ground')],t+150000);const p=read(s,point(150,.12));assert.equal(p.completed,true);assert.equal(p.sceneTime,t+120000);
 s.ingest([point(180,.13,'ground')],t+180000);assert.equal(read(s,point(180,.13)).distanceKm,p.distanceKm);assert.equal(read(s,point(180,.13)).elapsedMinutes,p.elapsedMinutes);
 s.ingest([point(210,.15,1000),point(240,.2,2000)],t+240000);assert.equal(s.records.size,2);assert.equal(read(s,point(240,.2)).takeoff,t+210000);assert.ok(read(s,point(240,.2)).distanceKm<p.distanceKm);
});
test('one stray ground report does not manufacture a new departure for an already airborne partial record',()=>{
 const s=new Progress();s.ingest([point(0,0),point(30,.03,'ground'),point(60,.06),point(90,.09)],t+90000);assert.equal(read(s,point(90,.09)).takeoff,null);assert.equal(s.records.size,1);
});
test('serialized records survive reload with cumulative distance, gap boundaries and coverage labels intact',()=>{
 const s=departure();s.ingest([point(240,.9),point(270,.94)],t+270000);const values=plain([...s.records.values()]),restored=new Progress();restored.restore(values,t+270000);assert.deepEqual(plain(read(restored,point(270,.94))),plain(read(s,point(270,.94))));restored.ingest([point(270,.94)],t+270000);assert.equal(restored.records.size,1);
});
test('bounded compaction retains cumulative distance and cannot upgrade partial coverage',()=>{
 const s=new Progress({maxPoints:4});for(let n=0;n<12;n++)s.ingest([point(n*30,n*.03)],t+n*30000);const f=[...s.records.values()][0];assert.equal(f.points.length,4);assert.ok(read(s,point(330,.33)).distanceKm>20);assert.equal(read(s,point(330,.33)).timeLabel,'Time observed');assert.equal(read(s,point(330,.33)).elapsedMinutes,5);
});
test('retention and budget evict completed flights first, without fabricating continuity',()=>{
 const s=new Progress({budget:5000});s.ingest([point(0,0),point(30,.03),point(60,.04,'ground'),point(90,.05,'ground')],t+90000);s.ingest([point(120,.1,1000,{hex:'abcdef',r:'N1'})],t+120000);s.ingest([point(150,.1,1000,{hex:'aaaaaa',r:'N2'})],t+150000);s.ingest([point(180,.1,1000,{hex:'bbbbbb',r:'N3'})],t+180000);assert.ok(![...s.records.values()].some(f=>f.completed));assert.ok([...s.records.values()].reduce((n,f)=>n+1024+f.points.length*512,0)<=5000);s.prune(t+172800001+180000);assert.equal(s.records.size,0);assert.ok(s.deleted.size>0);
});
test('invalid, non-ICAO, future and expired positions never create progress',()=>{
 const s=new Progress();for(const a of [point(30,0,1000,{hex:'~abcdef'}),point(30,0,1000,{lat:91}),point(30,0,1000,{lon:NaN}),point(30,0,1000,{positionTime:t+999999}),point(30,0,1000,{positionTime:t-172800001})])s.ingest([a],t);assert.equal(s.records.size,0);
});
test('taxi gaps before a freshly observed departure do not taint airborne coverage',()=>{
 const s=new Progress();s.ingest([point(0,0,'ground'),point(180,.01,'ground'),point(210,.02,1000),point(240,.06,2000)],t+240000);const p=read(s,point(240,.06));assert.equal(p.takeoff,t+210000);assert.equal(p.distanceLabel,'Distance covered');assert.equal(p.timeLabel,'Time airborne');
});
test('old position-only journal coordinates anchor partial time without inventing airborne distance',()=>{
 const rows=[point(0,0,null),point(30,.03,null)],s=new Progress();s.ingest(rows,t+30000);s.ingest([point(60,.06,2000),point(90,.09,3000)],t+90000);const p=read(s,point(90,.09));assert.equal(p.timeLabel,'Time observed');assert.equal(p.elapsedMinutes,1);assert.equal(p.takeoff,null);assert.ok(p.distanceKm>2&&p.distanceKm<3);
});
test('widely separated airborne reports cannot confirm a fresh departure pair',()=>{
 const s=new Progress();s.ingest([point(0,0,'ground'),point(30,.02,1000),point(240,.2,2000),point(270,.24,3000)],t+270000);assert.equal(read(s,point(270,.24)).takeoff,null);assert.equal(read(s,point(270,.24)).timeLabel,'Time observed');
});
test('a first ground report holds the counter, and fresh confirmation finalizes that observed landing time',()=>{
 const s=departure();s.ingest([point(90,.1,'ground')],t+90000);const first=read(s,point(90,.1));s.ingest([point(300,.12,'ground')],t+300000);assert.equal(read(s,point(300,.12)).elapsedMinutes,first.elapsedMinutes);assert.equal(read(s,point(300,.12)).completed,false);s.ingest([point(330,.13,'ground')],t+330000);const final=read(s,point(330,.13));assert.equal(final.landing,t+90000);assert.equal(final.elapsedMinutes,first.elapsedMinutes);assert.equal(final.completed,true);
});
test('fresh taxi reports cannot keep a completed flight beyond the 48-hour horizon',()=>{
 const s=departure();s.ingest([point(90,.1,'ground'),point(120,.11,'ground')],t+120000);const id=read(s,point(120,.11)).flightId,now=t+172800000+121000;
 const a={...point(121,.12,'ground'),positionTime:now};s.ingest([a],now);assert.equal(s.records.has(id),false);assert.equal(s.deleted.has(id),true);assert.equal(read(s,a).timeLabel,'Time observed');assert.equal(read(s,a).distanceKm,null);
});
