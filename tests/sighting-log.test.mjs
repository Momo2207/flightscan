import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.split('/* SIGHTING_LOG_START:')[1].split('/* SIGHTING_LOG_END */')[0];
const Log=vm.runInNewContext('/* SIGHTING_LOG_START:'+source+'\nSightingLog');
const now=Date.parse('2026-09-29T12:00:00Z'),DAY=86400000;
const row=(patch={})=>({hex:'3c4b31',flight:'DLH123',r:'D-AIBQ',t:'A320',lat:48,lon:8,positionTime:now-1000,...patch});
const all=()=>true;

test('one aircraft stays unique across repeated reports and changing callsigns',()=>{
 const log=new Log();log.record('home','Home',[row(),row()],all,now);
 log.record('home','Home',[row({hex:'3C4B31',flight:'DLH456',positionTime:now+29000})],all,now+30000);
 const list=log.list('home',now+30000);assert.equal(list.length,1);assert.equal(list[0].flight,'DLH456');assert.equal(list[0].firstSeen,now-1000);assert.equal(list[0].lastSeen,now+29000);
});
test('two aircraft with the same callsign remain distinct',()=>{
 const log=new Log();log.record('home','Home',[row(),row({hex:'abcdef'})],all,now);assert.equal(log.list('home',now).length,2);
});
test('actual observation timestamps control expiry, not response receipt or cached repeats',()=>{
 const log=new Log();log.record('home','Home',[row()],all,now);
 log.record('home','Home',[row()],all,now+50000);assert.equal(log.list('home',now+DAY-1001).length,1);assert.equal(log.list('home',now+DAY-1000).length,0);
});
test('collection-buffer aircraft outside the visible scope are not logged',()=>{
 const log=new Log();log.record('home','Home',[row(),row({hex:'abcdef',lat:60})],a=>a.lat<50,now);assert.equal(log.list('home',now).length,1);
});
test('invalid, stale, future and non-ICAO observations cannot invent sightings',()=>{
 const log=new Log();log.record('home','Home',[row({hex:'~abc123'}),row({hex:'<bad>'}),row({positionTime:NaN}),row({positionTime:now+1}),row({positionTime:now-120001})],all,now);assert.equal(log.list('home',now).length,0);
});
test('history survives serialization and maintains separate geographic areas',()=>{
 const log=new Log();log.record('home','Home',[row()],all,now);log.record('away','Away',[row({hex:'abcdef'})],all,now);
 const restored=new Log(JSON.parse(JSON.stringify(log.export(now))),now+3600000);
 assert.equal(restored.list('home',now+3600000)[0].hex,'3c4b31');assert.equal(restored.list('away',now+3600000)[0].hex,'abcdef');
 assert.equal(restored.list('home',now+DAY).length,0);
});
test('another tab can merge sightings without overwriting newer observations',()=>{
 const first=new Log(),second=new Log();first.record('home','Home',[row({flight:'DLH456'})],all,now);
 second.record('home','Home',[row({flight:'DLH000',positionTime:now-10000}),row({hex:'abcdef'})],all,now);
 first.merge(second.export(now),now);assert.equal(first.list('home',now).length,2);assert.equal(first.list('home',now).find(a=>a.hex==='3c4b31').flight,'DLH456');
});
test('an OpenSky observation can retain a known type without inventing a callsign',()=>{
 const log=new Log();log.record('home','Home',[row()],all,now);log.record('home','Home',[row({r:undefined,t:undefined,flight:'',positionTime:now+1000})],all,now+2000);
 const a=log.list('home',now+2000)[0];assert.equal(a.t,'A320');assert.equal(a.r,'D-AIBQ');assert.equal(a.flight,'');
});
test('returning aircraft after window expiry starts a new entry while area identity remains',()=>{
 const log=new Log();log.record('home','Home',[row()],all,now);
 log.record('home','Home',[row({positionTime:now+DAY})],all,now+DAY+1);assert.equal(log.list('home',now+DAY+1)[0].firstSeen,now+DAY);
 log.prune(now+3*DAY+1);assert.equal(log.list('home',now+3*DAY+1).length,0);assert.equal(log.areas.get('home').visits.size,0);
});
test('area identities are retained instead of dropping pending history at the eighth place',()=>{
 const log=new Log();for(let i=0;i<12;i++)log.record('area'+i,'Area',[row({positionTime:now+i})],all,now+i);
 assert.equal(log.areas.size,12);assert.equal(log.list('area0',now+12).length,1);assert.equal(log.list('area11',now+12).length,1);
});
