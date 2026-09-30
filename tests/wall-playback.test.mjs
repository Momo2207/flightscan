import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.split('/* PLAYBACK_ENGINE_START:')[1].split('/* PLAYBACK_ENGINE_END */')[0];
const Engine=vm.runInNewContext('/* PLAYBACK_ENGINE_START:'+source+'\nAircraftPlayback');
const now=1800000000000;
const observation=(seconds,extra={})=>({hex:'3c4b31',lat:48.47,lon:7.94+seconds*.002,positionTime:now+seconds*1000,track:90,gs:280,alt_baro:10000+seconds*10,flight:'DLH123',...extra});
const close=(a,b,epsilon=1e-4)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);

test('interpolates position and metrics on the requested delayed timeline',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30)],now+90000,'adsb.fi');
 const [p]=e.sample(now+15000,now+105000);close(p.lon,7.97);close(p.alt_baro,10150);assert.equal(p.displayTime,now+15000);assert.equal(p.positionTime,now);assert.equal(p.source,'adsb.fi');assert.equal(p.interpolated,true);
});
test('continuous motion across multiple polls, not a short transition at refresh',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30),observation(60)],now+60000);
 let previous=7.93;for(let t=1;t<=59;t+=.25){const [p]=e.sample(now+t*1000,now+(t+90)*1000);assert.ok(p.lon>previous);assert.ok(p.lon-previous<.012);previous=p.lon}
});
test('all tracks share a monotonic playback time, including a backwards clock change',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30),observation(0,{hex:'abc123'}),observation(30,{hex:'abc123'})],now+30000);
 const p=e.sample(now+15000,now+105000);assert.equal(p.length,2);assert.equal(p[0].displayTime,p[1].displayTime);const next=e.sample(now+14000,now+104000);assert.equal(next[0].displayTime,now+15000);close(next[0].lon,p[0].lon);
});
test('heading takes the shortest path through north',()=>{
 const e=new Engine();e.ingest([observation(0,{track:350}),observation(30,{track:10})],now+30000);const [p]=e.sample(now+15000,now+105000);close(p.track,0);
});
test('date line interpolation follows the short great-circle arc',()=>{
 const e=new Engine();e.ingest([observation(0,{lat:0,lon:179.9}),observation(60,{lat:0,lon:-179.9})],now+60000);const [p]=e.sample(now+30000,now+120000);close(Math.abs(p.lon),180);
});
test('deduplicates repeated timestamps and ignores invalid/future positions',()=>{
 const e=new Engine();e.ingest([observation(0),observation(0),observation(20,{lat:NaN}),observation(20,{lon:181}),observation(100),observation(10,{hex:'<script>'})],now+30000);assert.equal(e.tracks.size,1);assert.equal(e.tracks.get('3c4b31').points.length,1);
});
test('sorts out-of-order observations before playback begins',()=>{
 const e=new Engine();e.ingest([observation(60),observation(0),observation(30)],now+60000);assert.equal(e.tracks.get('3c4b31').points[0].positionTime,now);close(e.sample(now+15000,now+105000)[0].lon,7.97);
});
test('late/provider-switched reports cannot revise a committed segment',()=>{
 const e=new Engine();e.ingest([observation(0),observation(60)],now+60000,'A');e.sample(now+15000,now+105000);
 e.ingest([observation(5,{lon:7.8}),observation(30,{lon:7.8})],now+110000,'B');
 close(e.sample(now+30000,now+120000)[0].lon,8.0);assert.equal(e.tracks.get('3c4b31').points.some(p=>p.positionTime===now+5000),false);
});
test('startup never shows an unbracketed first position',()=>{
 const e=new Engine();e.ingest([observation(0)],now);assert.equal(e.sample(now-90000,now).length,0);assert.equal(e.sample(now+10000,now+100000).length,0);
});
test('buffer underrun holds the endpoint, fades, then removes it',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30)],now+30000);e.sample(now+15000,now+105000);
 let p=e.sample(now+35000,now+125000)[0];assert.equal(p.held,true);close(p.lon,8);assert.equal(p.observationTime,now+30000);
 p=e.sample(now+65000,now+155000)[0];assert.ok(p.opacity<1);close(p.lon,8);
 assert.equal(e.sample(now+75000,now+165000).length,0);
});
test('late recovery never accelerates a held aircraft to catch up',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30)],now+30000);e.sample(now+15000,now+105000);e.sample(now+35000,now+125000);
 e.ingest([observation(60),observation(90)],now+130000);const held=e.sample(now+45000,now+135000)[0];assert.equal(held.held,true);close(held.lon,8);
 const stillHeld=e.sample(now+65000,now+155000)[0];assert.equal(stillHeld.held,true);assert.ok(stillHeld.opacity<1);
 const resumed=e.sample(now+75000,now+165000)[0];assert.equal(resumed.held,false);close(resumed.lon,8.09);assert.ok(resumed.opacity<1);
});
test('does not join long reception gaps or implausible jumps',()=>{
 const e=new Engine();e.ingest([observation(0),observation(180)],now+180000);assert.equal(e.sample(now+90000,now+180000).length,0);
 const e2=new Engine();e2.ingest([observation(0),observation(30,{lat:0,lon:0})],now+30000);assert.equal(e2.sample(now+15000,now+105000).length,0);
});
test('never invents missing metrics or leaks future identity metadata',()=>{
 const e=new Engine();e.ingest([observation(0,{gs:null,t:undefined,flight:'OLD1'}),observation(30,{gs:300,t:'A320',flight:'NEW2'})],now+30000);
 const [p]=e.sample(now+15000,now+105000);assert.equal(p.gs,null);assert.equal(p.t,undefined);assert.equal(p.flight,'OLD1');
});
test('ground to airborne does not interpolate a string altitude',()=>{
 const e=new Engine();e.ingest([observation(0,{alt_baro:'ground'}),observation(30,{alt_baro:1000})],now+30000);assert.equal(e.sample(now+15000,now+105000)[0].alt_baro,'ground');
});
test('trails stop at playback time and break on data gaps',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30),observation(60)],now+60000);e.sample(now+15000,now+105000);const trail=e.trace('3c4b31',now+15000);assert.equal(trail.length,2);assert.equal(trail.at(-1).positionTime,now+15000);assert.ok(trail.every(p=>p.positionTime<=now+15000));
 e.restart();e.ingest([observation(240),observation(270)],now+270000);e.sample(now+255000,now+345000);const trace=e.trace('3c4b31',now+255000,480000);assert.equal(trace[0].positionTime,now+240000);
});
test('memory stays bounded by track count, point count and retention',()=>{
 const e=new Engine({maxTracks:5,maxPoints:4,retention:120000});
 for(let i=0;i<20;i++)for(let sec=0;sec<100;sec+=5)e.ingest([observation(sec,{hex:i.toString(16).padStart(6,'0')})],now+100000);
 assert.equal(e.tracks.size,5);assert.ok([...e.tracks.values()].every(t=>t.points.length<=4));e.prune(now+300000);assert.equal(e.tracks.size,0);
});
test('explicit delay changes can restart playback without losing buffered observations',()=>{
 const e=new Engine();e.ingest([observation(0),observation(30),observation(60)],now+60000);e.sample(now+45000,now+135000);e.restart();assert.equal(e.tracks.size,1);close(e.sample(now+15000,now+135000)[0].lon,7.97);e.clear();assert.equal(e.tracks.size,0);
});
test('24-hour synthetic observation run retains bounded data and finite positions',()=>{
 const e=new Engine();
 for(let sec=0;sec<=86400;sec+=30){
  const wallNow=now+sec*1000;
  e.ingest(Array.from({length:40},(_,i)=>observation(sec,{hex:i.toString(16).padStart(6,'0'),lon:7.94+Math.sin(sec/4000+i)*.3,lat:48.47+Math.cos(sec/4000+i)*.2})),wallNow);
  const result=e.sample(wallNow-90000,wallNow);for(const p of result)assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lon));
 }
 assert.equal(e.tracks.size,40);assert.ok([...e.tracks.values()].every(t=>t.points.length<=17));
});
